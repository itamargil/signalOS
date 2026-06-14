import { ApifyClient } from "apify-client";
import { recordCost, costCtx } from "@/lib/cost";
import { logActivity } from "@/lib/activity";

let _client: ApifyClient | null = null;
export function apify(): ApifyClient {
  if (!_client) {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error("Missing APIFY_TOKEN in env");
    _client = new ApifyClient({ token });
  }
  return _client;
}

/** Run an actor to completion, record its cost, and return dataset items. */
export async function runActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<any[]> {
  const runId = costCtx().runId;
  if (runId) await logActivity(runId, "actor", `⚙️  scraping via ${actorId}…`);
  const run = await apify().actor(actorId).call(input);

  // `usageTotalUsd` is populated on the persisted run record but not always on
  // the value returned by .call(), so re-fetch the run when it's missing.
  let amount = toNum(pick(run, "usageTotalUsd", "usageUsd"));
  if (amount == null && run?.id) {
    const full = await apify().run(run.id).get().catch(() => null);
    amount = toNum(pick(full, "usageTotalUsd", "usageUsd"));
  }
  await recordCost({
    provider: "apify",
    category: "scrape",
    amountUsd: amount ?? 0,
    description: actorId,
    metadata: { runId: run?.id, status: run?.status },
  });

  if (!run?.defaultDatasetId) return [];
  const { items } = await apify().dataset(run.defaultDatasetId).listItems();
  if (runId) {
    await logActivity(
      runId,
      "actor",
      `⚙️  ${actorId} → ${items.length} results · $${(amount ?? 0).toFixed(4)}`
    );
  }
  return items as any[];
}

/** First defined value among several possible field names. */
export function pick<T = unknown>(obj: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

export function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "string" ? Number(v.replace(/[, ]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}
