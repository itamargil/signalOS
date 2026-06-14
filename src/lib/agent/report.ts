import { complete, extractJson } from "@/lib/llm/client";
import type { AnalysisResult } from "./analysis";

export interface Scorecard {
  demand: number; // 0-100
  competition: number; // 0-100 (higher = more crowded)
  feasibility: number; // 0-100
  overall: number; // 0-100
  verdict: "go" | "explore" | "pass";
  oneLiner: string;
}

export interface SignalReport {
  summary: string;
  body_md: string;
  scorecard: Scorecard;
}

/**
 * Stage 4 — turn the analysis into a decision-ready signal report:
 * an executive summary, a scorecard, and a full markdown writeup that
 * tells you whether to advance the idea to MVP.
 */
export async function generateReport(args: {
  runId: string;
  ideaId: string;
  prompt: string;
  analysis: AnalysisResult;
  stats: {
    platforms: string[];
    sources: number;
    itemsTracked: number;
    samples: number;
    windowDays: number;
  };
}): Promise<SignalReport> {
  const system = `You are writing a market-signal report that decides whether a product idea
advances to MVP. Be decisive and honest — a clear "pass" is more valuable than a hedge.

Produce ONLY JSON:
{
 "scorecard":{"demand":0,"competition":0,"feasibility":0,"overall":0,"verdict":"go|explore|pass","oneLiner":""},
 "summary":"2-3 sentence executive summary",
 "body_md":"full markdown report"
}

The body_md must include these sections:
## Verdict
## Demand Signal (with the strongest evidence + engagement velocity)
## Audience & Pain Points
## Themes
## Objections & Risks
## Competition / What Already Exists
## Recommended Next Step (concrete MVP framing or kill criteria)
## Method & Coverage (what was tracked)`;

  const user = `Product idea:
"""
${args.prompt}
"""

Coverage: ${args.stats.platforms.join(", ")} · ${args.stats.sources} sources ·
${args.stats.itemsTracked} items · ${args.stats.samples} samples over ${args.stats.windowDays} days.

Analysis findings:
${JSON.stringify(args.analysis, null, 2)}

Write the report.`;

  const { text } = await complete({
    runId: args.runId,
    ideaId: args.ideaId,
    stage: "report",
    purpose: "generate_report",
    system,
    messages: [{ role: "user", content: user }],
    maxTokens: 6000,
  });

  return extractJson<SignalReport>(text);
}
