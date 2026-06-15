import { inngest, EVENTS } from "@/inngest/client";
import { db } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { notifyApproval, notifyReport } from "@/lib/email";
import { adapterFor } from "@/lib/sources";
import { buildDiscoveryPrompt, parseDiscovery } from "@/lib/agent/discovery";
import { buildAnalysisPrompt, parseAnalysis, type ItemDigest } from "@/lib/agent/analysis";
import { buildReportPrompt, parseReport } from "@/lib/agent/report";
import { runPrompt, applyPromptEdits, type EditablePrompt } from "@/lib/agent/prompt";
import { velocity, first, latest, type SamplePoint } from "@/lib/metrics";
import { runWithCostCtx } from "@/lib/cost";
import type { Platform, RunConfig, Source, ScrapeSettings } from "@/lib/types";

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

    // Manual step-runner: every step is a gate — you review/edit what will run,
    // then click Run. Nothing executes ahead of you.

    // ───────────────────────── DISCOVERY ─────────────────────────
    await step.run("discovery-start", async () => {
      await db()
        .from("runs")
        .update({ status: "running", stage: "discovery", started_at: new Date().toISOString() })
        .eq("id", runId);
      await logActivity(runId, "stage_change", "Discovery started", { platforms: cfg.platforms });
    });

    let discoveryPrompt: EditablePrompt = buildDiscoveryPrompt(loaded.idea.prompt, cfg.platforms);
    let scrapeSettings: ScrapeSettings = { limit: 40, sort: "top", time: "month" };
    let attempt = 0;
    let fetchConfigured = false;

    while (!fetchConfigured) {
      // 1) review/edit the discovery prompt, then Run it
      await step.run(`disc-prompt-gate-${attempt}`, () =>
        openPromptGate(runId, ideaTitle, "discovery_prompt", "Discovery — review the prompt", discoveryPrompt)
      );
      const pe = await step.waitForEvent(`wait-disc-prompt-${attempt}`, {
        event: EVENTS.approvalDecided,
        timeout: "14d",
        if: "async.data.runId == event.data.runId && async.data.stage == 'discovery_prompt'",
      });
      if (!pe) return finish(runId, "failed", "Discovery prompt review timed out");
      if (pe.data.action === "stop") return finish(runId, "cancelled", "Stopped at discovery");
      discoveryPrompt = applyPromptEdits(discoveryPrompt, pe.data.editedPrompt as any);

      // run discovery → propose sources
      const promptForRun = discoveryPrompt;
      const disc = await step.run(`run-discovery-${attempt}`, async () => {
        await db().from("runs").update({ status: "running", stage: "discovery" }).eq("id", runId);
        await logActivity(runId, "info", "Brainstorming sources from the idea…");
        const text = await runPrompt(promptForRun, {
          runId, ideaId, stage: "discovery", purpose: "propose_sources", maxTokens: 8000,
        });
        let proposed;
        try {
          proposed = parseDiscovery(text, cfg.platforms);
        } catch (e) {
          await logActivity(
            runId,
            "error",
            "Couldn't parse the discovery output (it may have been cut off). Edit the prompt to be more focused or use fewer platforms, then run again.",
            { error: e instanceof Error ? e.message : String(e) }
          );
          await db().from("runs").update({ status: "awaiting_approval", stage: "discovery" }).eq("id", runId);
          return { ok: false };
        }
        await db().from("sources").delete().eq("run_id", runId).eq("status", "proposed");
        if (proposed.length) {
          await db().from("sources").insert(proposed.map((p) => ({
            run_id: runId, platform: p.platform, kind: p.kind, handle: p.handle,
            url: p.url ?? null, rationale: p.rationale, status: "proposed",
          })));
        }
        await db().from("approvals").insert({
          run_id: runId, stage: "fetch",
          title: `Fetch — pick sources & settings (${proposed.length} proposed)`,
          payload: { count: proposed.length, prompt: promptForRun, scrapeSettings }, status: "pending",
        });
        await db().from("runs").update({ status: "awaiting_approval" }).eq("id", runId);
        await logActivity(runId, "approval_requested", `Proposed ${proposed.length} sources — pick what to fetch`);
        await notifyApproval({ runId, ideaTitle, stage: "fetch", count: proposed.length });
        return { ok: true };
      });

      // parse failed — loop back to let the user adjust the prompt and retry
      if (!disc.ok) {
        attempt++;
        continue;
      }

      // 3) fetch gate — pick sources + scrape settings → Run fetch / regenerate / stop
      const dec = await step.waitForEvent(`wait-fetch-${attempt}`, {
        event: EVENTS.approvalDecided,
        timeout: "14d",
        if: "async.data.runId == event.data.runId && async.data.stage == 'fetch'",
      });
      if (!dec) return finish(runId, "failed", "Fetch step timed out");
      if (dec.data.action === "stop") return finish(runId, "cancelled", "Stopped at fetch");
      if (dec.data.action === "regenerate") {
        discoveryPrompt = applyPromptEdits(discoveryPrompt, dec.data.editedPrompt as any);
        await logActivity(runId, "info", "Regenerating sources with adjusted prompt…");
        attempt++;
        continue;
      }
      // "run" — the API flipped the chosen sources; capture the scrape settings
      if (dec.data.scrapeSettings) scrapeSettings = dec.data.scrapeSettings as ScrapeSettings;
      fetchConfigured = true;
    }

    // ──────────────────── FETCH (run the scrape) ────────────────────
    const approvedSources = await step.run("load-approved", async () => {
      await db().from("runs").update({ status: "running", stage: "fetch" }).eq("id", runId);
      const { data } = await db()
        .from("sources")
        .select("*")
        .eq("run_id", runId)
        .eq("status", "approved");
      return (data || []) as Source[];
    });

    let itemCount = 0;
    for (const src of approvedSources) {
      const n: number = await step.run(`fetch-${src.id}`, () =>
        withCost(() => fetchSource(runId, src, scrapeSettings))
      );
      itemCount += n;
    }
    await step.run("fetch-done", () =>
      logActivity(runId, "info", `Fetched ${itemCount} items across ${approvedSources.length} sources`)
    );

    // ──────────── SAMPLE (manual: capture snapshots, then proceed) ────────────
    // The fetch already captured snapshot #1. Each "sample again" adds another
    // so we can compute engagement velocity. You proceed when satisfied.
    let sampleRound = 0;
    let samplingDone = false;
    while (!samplingDone) {
      await step.run(`sample-gate-${sampleRound}`, () =>
        openSampleGate(runId, ideaTitle, sampleRound, approvedSources.length)
      );
      const sd = await step.waitForEvent(`wait-sample-${sampleRound}`, {
        event: EVENTS.approvalDecided,
        timeout: "14d",
        if: "async.data.runId == event.data.runId && async.data.stage == 'sample'",
      });
      if (!sd) return finish(runId, "failed", "Sample step timed out");
      if (sd.data.action === "stop") return finish(runId, "cancelled", "Stopped at sampling");
      if (sd.data.action === "proceed") {
        samplingDone = true;
        break;
      }
      // "sample_again" — capture another engagement snapshot
      await step.run(`resample-${sampleRound}`, () =>
        withCost(async () => {
          await resampleAll(runId);
          await logActivity(runId, "sample", `Captured engagement snapshot #${sampleRound + 2}`);
        })
      );
      sampleRound++;
    }

    // ───────────────────────── ANALYSIS ─────────────────────────
    const analysisBuilt = await step.run("build-analysis", async () => {
      await db().from("runs").update({ stage: "analysis" }).eq("id", runId);
      await logActivity(runId, "stage_change", "Analysis started");
      const digests = await buildDigests(runId);
      return { prompt: buildAnalysisPrompt(loaded.idea.prompt, digests), count: digests.length };
    });

    let analysisPrompt: EditablePrompt = analysisBuilt.prompt;
    await step.run("analysis-prompt-gate", () =>
      openPromptGate(runId, ideaTitle, "analysis_prompt", "Analysis — review the prompt", analysisPrompt)
    );
    {
      const pe = await step.waitForEvent("wait-analysis-prompt", {
        event: EVENTS.approvalDecided,
        timeout: "14d",
        if: "async.data.runId == event.data.runId && async.data.stage == 'analysis_prompt'",
      });
      if (!pe) return finish(runId, "failed", "Analysis prompt review timed out");
      if (pe.data.action === "stop") return finish(runId, "cancelled", "Stopped at analysis prompt");
      analysisPrompt = applyPromptEdits(analysisPrompt, pe.data.editedPrompt as any);
    }

    const analysis = await step.run("run-analysis", async () => {
      await db().from("runs").update({ status: "running", stage: "analysis" }).eq("id", runId);
      await logActivity(runId, "analysis", `Summarizing signal from top ${analysisBuilt.count} items by engagement…`);
      const text = await runPrompt(analysisPrompt, {
        runId, ideaId, stage: "analysis", purpose: "analyze_signal", maxTokens: 6000,
      });
      const result = parseAnalysis(text);
      await logActivity(runId, "info", `Analysis complete: ${result.themes?.length ?? 0} themes`);
      return { result, count: analysisBuilt.count };
    });

    // ───────────────────────── REPORT ─────────────────────────
    const reportBuilt = await step.run("build-report", async () => {
      await db().from("runs").update({ stage: "report" }).eq("id", runId);
      const { count: sourcesCount } = await db()
        .from("sources")
        .select("id", { count: "exact", head: true })
        .eq("run_id", runId)
        .eq("status", "approved");
      const prompt = buildReportPrompt(loaded.idea.prompt, analysis.result, {
        platforms: cfg.platforms,
        sources: sourcesCount ?? 0,
        itemsTracked: analysis.count,
        samples: sampleRound + 1,
        windowDays: cfg.trackingDays,
      });
      return { prompt };
    });

    let reportPrompt: EditablePrompt = reportBuilt.prompt;
    await step.run("report-prompt-gate", () =>
      openPromptGate(runId, ideaTitle, "report_prompt", "Report — review the prompt", reportPrompt)
    );
    {
      const pe = await step.waitForEvent("wait-report-prompt", {
        event: EVENTS.approvalDecided,
        timeout: "14d",
        if: "async.data.runId == event.data.runId && async.data.stage == 'report_prompt'",
      });
      if (!pe) return finish(runId, "failed", "Report prompt review timed out");
      if (pe.data.action === "stop") return finish(runId, "cancelled", "Stopped at report prompt");
      reportPrompt = applyPromptEdits(reportPrompt, pe.data.editedPrompt as any);
    }

    await step.run("run-report", async () => {
      await db().from("runs").update({ status: "running", stage: "report" }).eq("id", runId);
      await logActivity(runId, "report", "Writing the signal report…");
      const text = await runPrompt(reportPrompt, {
        runId, ideaId, stage: "report", purpose: "generate_report", maxTokens: 8000,
      });
      const report = parseReport(text);
      await db().from("reports").insert({
        run_id: runId,
        idea_id: ideaId,
        summary: report.summary,
        body_md: report.body_md,
        scorecard: report.scorecard,
      });
      await db()
        .from("runs")
        .update({ status: "completed", stage: "done", completed_at: new Date().toISOString() })
        .eq("id", runId);
      await db().from("ideas").update({ status: "done" }).eq("id", ideaId);
      await logActivity(runId, "report", `Report ready — verdict: ${report.scorecard?.verdict}`);
      await notifyReport({ runId, ideaTitle });
    });

    return { runId, done: true };
  }
);

async function finish(runId: string, status: string, error: string) {
  await db().from("runs").update({ status, error }).eq("id", runId);
  await logActivity(runId, status === "cancelled" ? "info" : "error", error);
  return { runId, status, error };
}

/** Park the run at a prompt-review gate (stage ends "_prompt"). */
async function openPromptGate(
  runId: string,
  ideaTitle: string,
  stage: string,
  title: string,
  prompt: EditablePrompt
) {
  await db().from("approvals").insert({
    run_id: runId,
    stage,
    title,
    payload: { prompt },
    status: "pending",
  });
  await db().from("runs").update({ status: "awaiting_approval" }).eq("id", runId);
  await logActivity(runId, "approval_requested", title);
  await notifyApproval({ runId, ideaTitle, stage, count: 1 });
}

/** Park the run at the manual sampling gate (capture more snapshots, or proceed). */
async function openSampleGate(
  runId: string,
  ideaTitle: string,
  round: number,
  sources: number
) {
  await db().from("approvals").insert({
    run_id: runId,
    stage: "sample",
    title: round === 0 ? "Sample engagement" : `Sample engagement (${round + 1} captured)`,
    payload: { snapshotsCaptured: round + 1, sources },
    status: "pending",
  });
  await db().from("runs").update({ status: "awaiting_approval", stage: "sample" }).eq("id", runId);
  await logActivity(runId, "approval_requested", "Sampling gate — capture another snapshot or proceed");
  await notifyApproval({ runId, ideaTitle, stage: "sample", count: round + 1 });
}

/** Fetch one source's items + initial metrics. Returns items tracked. */
async function fetchSource(runId: string, src: Source, settings: ScrapeSettings): Promise<number> {
  const adapter = adapterFor(src.platform as Platform);
  try {
    await logActivity(runId, "fetch", `Fetching ${src.platform} ${src.handle}…`);
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
    const items = await adapter.fetchItems(src, {
      limit: settings.limit ?? 40,
      sort: settings.sort,
      time: settings.time,
    });
    if (!items.length) {
      await logActivity(runId, "fetch", `No items from ${src.platform} ${src.handle}`);
      return 0;
    }
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
    await logActivity(runId, "sample", `Fetched ${samples.length} items from ${src.platform} ${src.handle}`);
    return samples.length;
  } catch (e) {
    await logActivity(runId, "error", `Fetch failed for ${src.platform} ${src.handle}`, {
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
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
