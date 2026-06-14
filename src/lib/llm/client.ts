import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/supabase/server";
import { recordCost } from "@/lib/cost";
import { logActivity } from "@/lib/activity";

/**
 * The ONLY way the rest of the app talks to the model.
 * Every call — discovery, internal reasoning loops, analysis, final
 * report — is persisted to `llm_calls` with full input, raw output,
 * tokens, cost and latency. There is no path to call the model that
 * isn't logged.
 */

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY in env");
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

/**
 * Per-million-token pricing (USD). Approximate — edit to match your
 * actual rates. Matched by substring so model date suffixes still hit.
 */
const PRICING: Array<{ match: string; in: number; out: number }> = [
  { match: "opus", in: 15, out: 75 },
  { match: "sonnet", in: 3, out: 15 },
  { match: "haiku", in: 0.8, out: 4 },
  { match: "fable", in: 15, out: 75 },
];

function costUsd(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICING.find((x) => model.toLowerCase().includes(x.match));
  if (!p) return null;
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

export interface CompleteArgs {
  /** Logging context */
  runId?: string | null;
  ideaId?: string | null;
  stage?: string;
  purpose: string;
  /** Model call */
  system?: string;
  messages: Anthropic.MessageParam[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: Anthropic.Tool[];
}

export interface CompleteResult {
  text: string;
  raw: Anthropic.Message;
  toolUses: Anthropic.ToolUseBlock[];
  llmCallId: string | null;
}

export async function complete(args: CompleteArgs): Promise<CompleteResult> {
  const model = args.model || DEFAULT_MODEL;
  const params = {
    model,
    max_tokens: args.maxTokens ?? 4096,
    // NOTE: newer models (e.g. claude-opus-4-8) reject `temperature`. We omit
    // it unless explicitly requested; callers that pass one opt back in.
    ...(args.temperature != null ? { temperature: args.temperature } : {}),
    ...(args.system ? { system: args.system } : {}),
    messages: args.messages,
    ...(args.tools ? { tools: args.tools } : {}),
  } satisfies Anthropic.MessageCreateParamsNonStreaming;

  const startedAt = Date.now();
  let raw: Anthropic.Message | null = null;
  let errMsg: string | null = null;

  try {
    raw = await anthropic().messages.create(params);
    return packResult(raw);
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    const latency = Date.now() - startedAt;
    const inTok = raw?.usage?.input_tokens ?? null;
    const outTok = raw?.usage?.output_tokens ?? null;
    const text = raw ? flattenText(raw) : null;
    // Fire-and-forget log; never let logging failures break the agent.
    void logCall({
      runId: args.runId ?? null,
      ideaId: args.ideaId ?? null,
      stage: args.stage ?? "misc",
      purpose: args.purpose,
      model,
      system: args.system ?? null,
      messages: args.messages,
      params: {
        max_tokens: params.max_tokens,
        temperature: args.temperature ?? null,
        tools: args.tools?.map((t) => t.name) ?? [],
      },
      outputText: text,
      raw,
      stopReason: raw?.stop_reason ?? null,
      inputTokens: inTok,
      outputTokens: outTok,
      cost: inTok != null && outTok != null ? costUsd(model, inTok, outTok) : null,
      latencyMs: latency,
      status: errMsg ? "error" : "ok",
      error: errMsg,
    });
  }
}

function packResult(raw: Anthropic.Message): CompleteResult {
  const toolUses = raw.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  return { text: flattenText(raw), raw, toolUses, llmCallId: null };
}

function flattenText(raw: Anthropic.Message): string {
  return raw.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

interface LogArgs {
  runId: string | null;
  ideaId: string | null;
  stage: string;
  purpose: string;
  model: string;
  system: string | null;
  messages: unknown;
  params: unknown;
  outputText: string | null;
  raw: unknown;
  stopReason: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  latencyMs: number;
  status: string;
  error: string | null;
}

async function logCall(a: LogArgs) {
  try {
    await db().from("llm_calls").insert({
      run_id: a.runId,
      idea_id: a.ideaId,
      stage: a.stage,
      purpose: a.purpose,
      model: a.model,
      system_prompt: a.system,
      input: a.messages,
      params: a.params,
      output_text: a.outputText,
      output_raw: a.raw,
      stop_reason: a.stopReason,
      input_tokens: a.inputTokens,
      output_tokens: a.outputTokens,
      cost_usd: a.cost,
      latency_ms: a.latencyMs,
      status: a.status,
      error: a.error,
    });
  } catch (e) {
    console.error("[llm log] failed to persist llm_call:", e);
  }
  if (a.runId) {
    const toks =
      a.inputTokens != null ? ` · ${a.inputTokens}→${a.outputTokens} tok` : "";
    const cost = a.cost != null ? ` · $${a.cost.toFixed(4)}` : "";
    const msg =
      a.status === "error"
        ? `🧠 ${a.purpose} failed: ${(a.error || "").slice(0, 80)}`
        : `🧠 ${a.purpose} · ${a.model}${toks}${cost} · ${(a.latencyMs / 1000).toFixed(1)}s`;
    await logActivity(a.runId, a.status === "error" ? "error" : "llm", msg);
  }
  if (a.cost != null) {
    await recordCost({
      provider: "anthropic",
      category: "llm",
      amountUsd: a.cost,
      runId: a.runId,
      ideaId: a.ideaId,
      description: `${a.stage}:${a.purpose}`,
      units: a.outputTokens ?? undefined,
      metadata: {
        model: a.model,
        input_tokens: a.inputTokens,
        output_tokens: a.outputTokens,
      },
    });
  }
}

/** Parse a JSON object out of a model's text response, tolerating fences. */
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const arrStart = candidate.indexOf("[");
  const begin =
    arrStart !== -1 && (start === -1 || arrStart < start) ? arrStart : start;
  if (begin === -1) throw new Error("No JSON found in model output");
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  return JSON.parse(candidate.slice(begin, end + 1)) as T;
}
