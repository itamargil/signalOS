import { inngest, EVENTS } from "@/inngest/client";
import { db } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { notifyApproval, notifyReport } from "@/lib/email";
import { adapterFor } from "@/lib/sources";
import { proposeSources } from "@/lib/agent/discovery";
import { analyzeSignal, type ItemDigest } from "@/lib/agent/analysis";
import { generateReport } from "@/lib/agent/report";
import { velocity, first, latest, type SamplePoint } from "@/lib/metrics";
import { runWithCostCtx } from "@/lib/cost";
import type { Platform, RunConfig } from "@/lib/types";

/**
 * The research run. A durable, multi-day state machine:
 *   discovery → [APPROVAL] → initial tracking → [APPROVAL]
 *             → sampling loop (over the window) → analysis → report
 * Approval gates park the function until you decide in the dashboard.
 */
export const researchRun = inngest.createFunction(
  { id: "research-run", retries: 2 },
  { event: EVENTS.runStart },
  async ({ event, step }) => {
    const runId = event.data.runId as string;

    const loaded = await step.run("load", async () => {
      const { data: run } = await db().from("runs").select("*").eq("id", runId).single();
      if (!run) throw new Error(`run ${runId} not found`);
      const { data: idea } = await db()
        .from("ideas")
        .select("*")
        .eq("id", run.idea_id)
        .single();
      return { run, idea };
    });

    // Apify costs are attributed to this run/idea by setting the cost context
    // INSIDE each scraping step — AsyncLocalStorage doesn't survive Inngest's
    // step boundary, so wrapping the whole function isn't enough.
    const ideaId = loaded.run.idea_id;
    const withCost = <T>(fn: () => Promise<T>) => runWithCostCtx({ runId, ideaId }, fn);

    const cfg: RunConfig = {
      platforms: ["reddit", "x", "instagram"],
      trackingDays: 3,
      samples: 6,
      ...(loaded.run.config || {}),
    };
    const ideaTitle: string = loaded.idea?.title || loaded.idea?.prompt?.slice(0, 60) || "idea";

    // ───────────────────────── DISCOVERY ─────────────────────────
    await step.run("discovery", async () => {
      await db()
        .from("runs")
        .update({ status: "running", stage: "discovery", started_at: new Date().toISOString() })
        .eq("id", runId);
      await logActivity(runId, "stage_change", "Discovery started", { platforms: cfg.platforms });
      await logActivity(runId, "info", `Reading the idea and brainstorming sources on ${cfg.platforms.join(", ")}…`);

      const proposed = await proposeSources({
        runId,
        ideaId: loaded.run.idea_id,
        prompt: loaded.idea.prompt,
        platforms: cfg.platforms,
      });

      if (proposed.length) {
        await db().from("sources").insert(
          proposed.map((p) => ({
            run_id: runId,
            platform: p.platform,
            kind: p.kind,
            handle: p.handle,
            url: p.url ?? null,
            rationale: p.rationale,
            status: "proposed",
          }))
        );
      }
      await db().from("approvals").insert({
        run_id: runId,
        stage: "discovery",
        title: `Review ${proposed.length} proposed sources`,
        payload: { count: proposed.length },
        status: "pending",
      });
      await db().from("runs").update({ status: "awaiting_approval" }).eq("id", runId);
      await logActivity(runId, "approval_requested", `Proposed ${proposed.length} sources for review`);
      await notifyApproval({ runId, ideaTitle, stage: "discovery", count: proposed.length });
    });

    const discApproval = await step.waitForEvent("wait-discovery", {
      event: EVENTS.approvalDecided,
      timeout: "14d",
      if: "async.data.runId == event.data.runId && async.data.stage == 'discovery'",
    });
    if (!discApproval) return finish(runId, "failed", "Discovery approval timed out");

    // ──────────────────── INITIAL TRACKING FETCH ────────────────────
    await step.run("track-fetch", () => withCost(async () => {
      await db().from("runs").update({ status: "running", stage: "tracking" }).eq("id", runId);
      const { data: sources } = await db()
        .from("sources")
        .select("*")
        .eq("run_id", runId)
        .eq("status", "approved");

      let itemCount = 0;
      for (const src of sources || []) {
        const adapter = adapterFor(src.platform as Platform);
        try {
          await logActivity(runId, "fetch", `Fetching ${src.platform} ${src.handle}…`);
          // account-level snapshot (followers etc.)
          const acct = await adapter.resolveHandle(src);
          if (acct) {
            await db().from("metric_samples").insert({
              run_id: runId,
              source_id: src.id,
              scope: "account",
              followers: acct.followers ?? null,
              score: acct.score ?? null,
              metrics: acct.raw,
            });
          }
          // items
          const items = await adapter.fetchItems(src, { limit: 40 });
          if (!items.length) continue;
          const { data: rows } = await db()
            .from("tracked_items")
            .upsert(
              items.map((it) => ({
                run_id: runId,
                source_id: src.id,
                platform: src.platform,
                external_id: it.external_id,
                url: it.url ?? null,
                author: it.author ?? null,
                title: it.title ?? null,
                body: it.body?.slice(0, 4000) ?? null,
                posted_at: it.posted_at ?? null,
                metadata: {},
              })),
              { onConflict: "run_id,platform,external_id" }
            )
            .select("id,external_id");

          const idByExt = new Map((rows || []).map((r: any) => [r.external_id, r.id]));
          const samples = items
            .filter((it) => idByExt.has(it.external_id))
            .map((it) => ({
              run_id: runId,
              source_id: src.id,
              tracked_item_id: idByExt.get(it.external_id),
              scope: "post" as const,
              likes: it.metrics.likes ?? null,
              comments: it.metrics.comments ?? null,
              shares: it.metrics.shares ?? null,
              views: it.metrics.views ?? null,
              score: it.metrics.score ?? null,
              metrics: it.metrics.raw,
            }));
          if (samples.length) await db().from("metric_samples").insert(samples);
          itemCount += samples.length;
          await logActivity(runId, "sample", `Fetched ${samples.length} items from ${src.platform} ${src.handle}`);
        } catch (e) {
          await logActivity(runId, "error", `Fetch failed for ${src.platform} ${src.handle}`, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      await db().from("approvals").insert({
        run_id: runId,
        stage: "tracking",
        title: `Confirm tracking of ${itemCount} items`,
        payload: { itemCount },
        status: "pending",
      });
      await db().from("runs").update({ status: "awaiting_approval" }).eq("id", runId);
      await logActivity(runId, "approval_requested", `Tracking ${itemCount} items — confirm to begin sampling`);
      await notifyApproval({ runId, ideaTitle, stage: "tracking", count: itemCount });
    }));

    const trackApproval = await step.waitForEvent("wait-tracking", {
      event: EVENTS.approvalDecided,
      timeout: "14d",
      if: "async.data.runId == event.data.runId && async.data.stage == 'tracking'",
    });
    if (!trackApproval) return finish(runId, "failed", "Tracking approval timed out");

    // ───────────────── SAMPLING LOOP (over the window) ─────────────────
    await step.run("sampling-start", async () => {
      await db().from("runs").update({ status: "running", stage: "tracking" }).eq("id", runId);
      await logActivity(runId, "info", `Sampling ${cfg.samples}x over ${cfg.trackingDays} days`);
    });

    const intervalMs = Math.max(
      60_000,
      Math.floor((cfg.trackingDays * 86_400_000) / cfg.samples)
    );
    for (let i = 0; i < cfg.samples; i++) {
      if (i > 0) await step.sleep(`sleep-${i}`, intervalMs);
      await step.run(`resample-${i}`, () =>
        withCost(async () => {
          await resampleAll(runId);
          await logActivity(runId, "sample", `Re-sample ${i + 1}/${cfg.samples} captured`);
        })
      );
    }

    // ───────────────────────── ANALYSIS ─────────────────────────
    const analysis = await step.run("analysis", async () => {
      await db().from("runs").update({ stage: "analysis" }).eq("id", runId);
      await logActivity(runId, "stage_change", "Analysis started");
      const digests = await buildDigests(runId);
      await logActivity(runId, "analysis", `Summarizing signal from top ${digests.length} items by engagement…`);
      const result = await analyzeSignal({
        runId,
        ideaId: loaded.run.idea_id,
        prompt: loaded.idea.prompt,
        digests,
      });
      await logActivity(runId, "info", `Analysis complete: ${result.themes?.length ?? 0} themes`);
      return { result, count: digests.length };
    });

    // ───────────────────────── REPORT ─────────────────────────
    await step.run("report", async () => {
      await db().from("runs").update({ stage: "report" }).eq("id", runId);
      await logActivity(runId, "report", "Writing the signal report…");
      const { data: sources } = await db()
        .from("sources")
        .select("id")
        .eq("run_id", runId)
        .eq("status", "approved");
      const report = await generateReport({
        runId,
        ideaId: loaded.run.idea_id,
        prompt: loaded.idea.prompt,
        analysis: analysis.result,
        stats: {
          platforms: cfg.platforms,
          sources: sources?.length ?? 0,
          itemsTracked: analysis.count,
          samples: cfg.samples,
          windowDays: cfg.trackingDays,
        },
      });
      await db().from("reports").insert({
        run_id: runId,
        idea_id: loaded.run.idea_id,
        summary: report.summary,
        body_md: report.body_md,
        scorecard: report.scorecard,
      });
      await db()
        .from("runs")
        .update({ status: "completed", stage: "done", completed_at: new Date().toISOString() })
        .eq("id", runId);
      await db().from("ideas").update({ status: "done" }).eq("id", loaded.run.idea_id);
      await logActivity(runId, "report", `Report ready — verdict: ${report.scorecard?.verdict}`);
      await notifyReport({ runId, ideaTitle });
    });

    return { runId, done: true };
  }
);

async function finish(runId: string, status: string, error: string) {
  await db().from("runs").update({ status, error }).eq("id", runId);
  await logActivity(runId, "error", error);
  return { runId, status, error };
}

/** Re-sample engagement for every tracked item + account in the run. */
async function resampleAll(runId: string) {
  const { data: items } = await db()
    .from("tracked_items")
    .select("id,platform,external_id,url,source_id")
    .eq("run_id", runId);
  if (!items?.length) return;

  // group by platform
  const byPlatform = new Map<Platform, any[]>();
  for (const it of items) {
    const arr = byPlatform.get(it.platform) || [];
    arr.push(it);
    byPlatform.set(it.platform, arr);
  }

  for (const [platform, list] of byPlatform) {
    const adapter = adapterFor(platform);
    try {
      const metrics = await adapter.sampleItems(
        list.map((it) => ({ external_id: it.external_id, url: it.url }))
      );
      const rows = list
        .filter((it) => metrics[it.external_id])
        .map((it) => {
          const m = metrics[it.external_id];
          return {
            run_id: runId,
            source_id: it.source_id,
            tracked_item_id: it.id,
            scope: "post" as const,
            likes: m.likes ?? null,
            comments: m.comments ?? null,
            shares: m.shares ?? null,
            views: m.views ?? null,
            score: m.score ?? null,
            metrics: m.raw,
          };
        });
      if (rows.length) await db().from("metric_samples").insert(rows);
    } catch (e) {
      await logActivity(runId, "error", `Re-sample failed for ${platform}`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

/** Build per-item digests (first/last metrics + velocity) for the analyst. */
async function buildDigests(runId: string, maxItems = 60): Promise<ItemDigest[]> {
  const { data: items } = await db()
    .from("tracked_items")
    .select("id,platform,author,title,body,url,posted_at")
    .eq("run_id", runId);
  if (!items?.length) return [];

  const { data: samples } = await db()
    .from("metric_samples")
    .select("tracked_item_id,captured_at,likes,comments,shares,views,score")
    .eq("run_id", runId)
    .eq("scope", "post");

  const byItem = new Map<string, SamplePoint[]>();
  for (const s of samples || []) {
    if (!s.tracked_item_id) continue;
    const arr = byItem.get(s.tracked_item_id) || [];
    arr.push(s as SamplePoint);
    byItem.set(s.tracked_item_id, arr);
  }

  const digests = items.map((it: any) => {
    const pts = byItem.get(it.id) || [];
    const last = latest(pts);
    return {
      platform: it.platform,
      author: it.author,
      title: it.title,
      excerpt: it.body?.slice(0, 280) ?? null,
      url: it.url,
      posted_at: it.posted_at,
      firstMetrics: first(pts),
      lastMetrics: last,
      velocity: velocity(pts),
      _eng:
        (last.likes ?? 0) + (last.comments ?? 0) + (last.score ?? 0) + (last.shares ?? 0),
    };
  });

  return digests
    .sort((a, b) => (b._eng as number) - (a._eng as number))
    .slice(0, maxItems)
    .map(({ _eng, ...rest }) => rest as ItemDigest);
}
