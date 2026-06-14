import { complete, extractJson } from "@/lib/llm/client";

/** Compact view of a tracked item + its engagement trajectory for the model. */
export interface ItemDigest {
  platform: string;
  author?: string | null;
  title?: string | null;
  excerpt?: string | null;
  url?: string | null;
  posted_at?: string | null;
  firstMetrics: Record<string, number | undefined>;
  lastMetrics: Record<string, number | undefined>;
  velocity?: Record<string, number | undefined>; // change per hour
}

export interface AnalysisResult {
  themes: { name: string; summary: string; evidence: string[] }[];
  painPoints: string[];
  demandSignals: string[];
  objections: string[];
  audience: string;
  topItems: { url: string; why: string }[];
  notes: string;
}

/**
 * Stage 3 — synthesize the tracked content + engagement velocity into
 * structured findings.
 */
export async function analyzeSignal(args: {
  runId: string;
  ideaId: string;
  prompt: string;
  digests: ItemDigest[];
}): Promise<AnalysisResult> {
  const system = `You are a market-research analyst. You are given a product idea and a
sample of real posts/threads/tweets with their engagement trajectories (velocity = change
per hour). Identify what the data actually says about demand for the idea.

Be skeptical and evidence-driven. High engagement velocity on a pain point = strong signal.
Distinguish genuine demand from noise. Cite specific items as evidence (by url).

Return ONLY JSON:
{
 "themes":[{"name":"","summary":"","evidence":["url"]}],
 "painPoints":[""],
 "demandSignals":[""],
 "objections":[""],
 "audience":"",
 "topItems":[{"url":"","why":""}],
 "notes":""
}`;

  const user = `Product idea:
"""
${args.prompt}
"""

Tracked items (${args.digests.length}), with engagement trajectories:
${JSON.stringify(args.digests, null, 2)}

Analyze the signal.`;

  const { text } = await complete({
    runId: args.runId,
    ideaId: args.ideaId,
    stage: "analysis",
    purpose: "analyze_signal",
    system,
    messages: [{ role: "user", content: user }],
    maxTokens: 4000,
  });

  return extractJson<AnalysisResult>(text);
}
