import { extractJson } from "@/lib/llm/client";
import type { EditablePrompt } from "./prompt";

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

/** Stage 3 — synthesize tracked content + engagement velocity into findings. */
export function buildAnalysisPrompt(prompt: string, digests: ItemDigest[]): EditablePrompt {
  const system = `You are a market-research analyst. You are given a product idea and a
sample of real posts/threads/tweets with their engagement trajectories (velocity = change
per hour). Identify what the data actually says about demand for the idea.

Be skeptical and evidence-driven. High engagement velocity on a pain point = strong signal.
Distinguish genuine demand from noise. Cite specific items as evidence (by url).`;

  const lockedSuffix = `Return ONLY JSON:
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
${prompt}
"""

Tracked items (${digests.length}), with engagement trajectories:
${JSON.stringify(digests, null, 2)}

Analyze the signal.`;

  return { system, lockedSuffix, user };
}

export function parseAnalysis(text: string): AnalysisResult {
  return extractJson<AnalysisResult>(text);
}
