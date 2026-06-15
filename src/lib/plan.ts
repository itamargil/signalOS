import type { Platform, Run, Source } from "@/lib/types";

/**
 * Compute a human-readable preview of what the run will do next: the upcoming
 * step, which tools/scrapers + model will run, and rough runtime/cost estimates.
 * Estimates are heuristic — scrape times and costs vary — shown as a guide.
 */

export interface ToolUse {
  label: string; // what shows in the UI
  kind: "scraper" | "model" | "api";
  runs: number; // how many times it will run this step
}

export interface StepPlan {
  title: string;
  description: string;
  tools: ToolUse[];
  estSeconds: number;
  estCostUsd: number;
}

// Per-platform scrape cost/time heuristics (one actor run). Keyed by string so
// new platforms slot in without touching the Platform union.
const PLATFORM: Record<string, { label: string; sec: number; usd: number }> = {
  reddit: { label: redditLabel(), sec: 60, usd: 0.25 },
  x: { label: process.env.APIFY_X_ACTOR || "xquik/x-tweet-scraper", sec: 15, usd: 0.02 },
  instagram: { label: process.env.APIFY_INSTAGRAM_ACTOR || "apify/instagram-scraper", sec: 40, usd: 0.07 },
};

function redditLabel() {
  const oauth = process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET;
  if (oauth) return "Reddit Official API";
  return process.env.REDDIT_APIFY_ACTOR || "harshmaur/reddit-scraper";
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const LLM_SEC = 20;
const LLM_USD = 0.15;

function platformsOf(sources: Source[]): Platform[] {
  return [...new Set(sources.map((s) => s.platform))] as Platform[];
}

function modelPlan(title: string, description: string, label: string): StepPlan {
  return {
    title,
    description,
    tools: [{ label: `${MODEL} (${label})`, kind: "model", runs: 1 }],
    estSeconds: LLM_SEC,
    estCostUsd: LLM_USD,
  };
}

export function nextStepPlan(run: Run, sources: Source[], pendingStage?: string): StepPlan | null {
  const cfg = run.config || ({} as any);
  const samples = cfg.samples ?? 6;
  const days = cfg.trackingDays ?? 3;

  // Sources relevant to "what runs next" — proposed at the discovery gate,
  // approved afterwards.
  const proposed = sources.filter((s) => s.status === "proposed");
  const approved = sources.filter((s) => s.status === "approved");

  // ── Prompt-review gates: next = run that model call ──
  if (pendingStage === "discovery_prompt")
    return modelPlan("Run discovery → propose sources", "The model reads your (edited) prompt and proposes sources to track.", "discovery");
  if (pendingStage === "analysis_prompt")
    return modelPlan("Run analysis → findings", "The model summarizes the tracked data into themes, pain points and demand signals.", "analysis");
  if (pendingStage === "report_prompt")
    return modelPlan("Run report → final report", "The model writes the decision-ready signal report and scorecard.", "report");

  // ── Fetch gate: next = scrape the selected sources ──
  const atFetch = pendingStage === "fetch" || (!pendingStage && run.status === "awaiting_approval" && run.stage === "fetch");
  if (atFetch) {
    const selected = proposed.length ? proposed : approved;
    const plats = platformsOf(selected);
    const sourceCount = (platform: Platform) =>
      selected.filter((source) => source.platform === platform).length;
    const tools = plats.map((p) => ({
      label: PLATFORM[p].label,
      kind: "scraper" as const,
      runs: sourceCount(p),
    }));
    const sec = plats.reduce((s, p) => s + PLATFORM[p].sec * sourceCount(p), 0);
    const usd = plats.reduce((s, p) => s + PLATFORM[p].usd * sourceCount(p), 0);
    return {
      title: "Run fetch — scrape the selected sources",
      description: "Runs one scraper per selected source to pull recent posts + engagement.",
      tools,
      estSeconds: sec,
      estCostUsd: usd,
    };
  }

  // ── Sample gate: next = capture one more engagement snapshot ──
  const atSample = pendingStage === "sample" || (!pendingStage && run.status === "awaiting_approval" && run.stage === "sample");
  if (atSample) {
    const plats = platformsOf(approved);
    const tools = plats.map((p) => ({ label: PLATFORM[p].label, kind: "scraper" as const, runs: 1 }));
    const sec = plats.reduce((s, p) => s + PLATFORM[p].sec, 0);
    const usd = plats.reduce((s, p) => s + PLATFORM[p].usd, 0);
    return {
      title: "Capture an engagement snapshot",
      description: "Re-scrapes the tracked items once to record current engagement (≥2 snapshots = velocity).",
      tools,
      estSeconds: sec,
      estCostUsd: usd,
    };
  }

  // ── Running discovery ──
  if (run.stage === "discovery") {
    return {
      title: "Working: proposing sources",
      description: "The agent is reading the idea and brainstorming the best places to listen.",
      tools: [{ label: `${MODEL} (discovery)`, kind: "model", runs: 1 }],
      estSeconds: LLM_SEC,
      estCostUsd: LLM_USD,
    };
  }

  // ── Other running states ──
  if (["fetch", "sample", "analysis", "report"].includes(run.stage)) {
    return {
      title: `Working: ${run.stage}`,
      description: "In progress — watch the live activity below.",
      tools: [],
      estSeconds: 0,
      estCostUsd: 0,
    };
  }

  return null; // done / nothing pending
}

export function fmtDuration(sec: number): string {
  if (sec <= 0) return "—";
  if (sec < 90) return `~${Math.round(sec)}s`;
  if (sec < 5400) return `~${Math.round(sec / 60)} min`;
  if (sec < 172800) return `~${(sec / 3600).toFixed(1)} hr`;
  return `~${(sec / 86400).toFixed(1)} days`;
}
