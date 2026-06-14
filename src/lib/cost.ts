import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/lib/supabase/server";

/**
 * Unified spend ledger. Every third-party cost — Anthropic tokens, Apify
 * actor runs, etc. — lands in `cost_events` so the /costs dashboard can
 * slice by provider, by idea, and in total.
 *
 * Run/idea attribution: LLM calls pass ids explicitly. Lower-level helpers
 * (Apify) read them from an execution-scoped context set at the top of the
 * workflow, so they don't need ids threaded through every call site.
 */

export interface CostCtx {
  runId?: string | null;
  ideaId?: string | null;
}

const als = new AsyncLocalStorage<CostCtx>();

/** Establish run/idea context for everything awaited inside `fn`. */
export function runWithCostCtx<T>(ctx: CostCtx, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn);
}

export function costCtx(): CostCtx {
  return als.getStore() || {};
}

export async function recordCost(args: {
  provider: string;
  category: string;
  amountUsd: number;
  runId?: string | null;
  ideaId?: string | null;
  description?: string;
  units?: number | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const ctx = costCtx();
    await db().from("cost_events").insert({
      run_id: args.runId ?? ctx.runId ?? null,
      idea_id: args.ideaId ?? ctx.ideaId ?? null,
      provider: args.provider,
      category: args.category,
      description: args.description ?? null,
      amount_usd: args.amountUsd,
      units: args.units ?? null,
      metadata: args.metadata ?? {},
    });
  } catch (e) {
    console.error("[cost] failed to record cost_event:", e);
  }
}
