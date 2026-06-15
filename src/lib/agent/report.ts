import { extractJson } from "@/lib/llm/client";
import type { EditablePrompt } from "./prompt";
import type { AnalysisResult } from "./analysis";

export interface Scorecard {
  demand: number;
  competition: number;
  feasibility: number;
  overall: number;
  verdict: "go" | "explore" | "pass";
  oneLiner: string;
}

export interface SignalReport {
  summary: string;
  body_md: string;
  scorecard: Scorecard;
}

export interface ReportStats {
  platforms: string[];
  sources: number;
  itemsTracked: number;
  samples: number;
  windowDays: number;
}

/** Stage 4 — turn the analysis into a decision-ready signal report. */
export function buildReportPrompt(
  prompt: string,
  analysis: AnalysisResult,
  stats: ReportStats
): EditablePrompt {
  const system = `You are writing a market-signal report that decides whether a product idea
advances to MVP. Be decisive and honest — a clear "pass" is more valuable than a hedge.

The body_md must include these sections:
## Verdict
## Demand Signal (with the strongest evidence + engagement velocity)
## Audience & Pain Points
## Themes
## Objections & Risks
## Competition / What Already Exists
## Recommended Next Step (concrete MVP framing or kill criteria)
## Method & Coverage (what was tracked)`;

  const lockedSuffix = `Produce ONLY JSON:
{
 "scorecard":{"demand":0,"competition":0,"feasibility":0,"overall":0,"verdict":"go|explore|pass","oneLiner":""},
 "summary":"2-3 sentence executive summary",
 "body_md":"full markdown report"
}`;

  const user = `Product idea:
"""
${prompt}
"""

Coverage: ${stats.platforms.join(", ")} · ${stats.sources} sources ·
${stats.itemsTracked} items · ${stats.samples} samples over ${stats.windowDays} days.

Analysis findings:
${JSON.stringify(analysis, null, 2)}

Write the report.`;

  return { system, lockedSuffix, user };
}

export function parseReport(text: string): SignalReport {
  return extractJson<SignalReport>(text);
}
