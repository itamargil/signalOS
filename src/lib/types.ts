export type Platform = "reddit" | "x" | "instagram";
export type SourceKind = "subreddit" | "account" | "search_term" | "hashtag";
export type RunStage =
  | "created"
  | "discovery"
  | "tracking"
  | "analysis"
  | "report"
  | "done";

export interface Idea {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  idea_id: string;
  status: string;
  stage: RunStage;
  config: RunConfig;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunConfig {
  platforms: Platform[];
  trackingDays: number; // length of the tracking window
  samples: number; // how many times to re-sample over the window
}

export interface Source {
  id: string;
  run_id: string;
  platform: Platform;
  kind: SourceKind;
  handle: string;
  url: string | null;
  rationale: string | null;
  status: "proposed" | "approved" | "rejected";
  metadata: Record<string, unknown>;
  created_at: string;
}

/** A proposed source before it has a DB row. */
export interface ProposedSource {
  platform: Platform;
  kind: SourceKind;
  handle: string;
  url?: string;
  rationale: string;
}

export interface TrackedItem {
  id?: string;
  run_id: string;
  source_id: string | null;
  platform: Platform;
  external_id: string;
  url?: string | null;
  author?: string | null;
  title?: string | null;
  body?: string | null;
  posted_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MetricSample {
  scope: "account" | "post";
  source_id?: string | null;
  tracked_item_id?: string | null;
  followers?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  views?: number | null;
  score?: number | null;
  metrics?: Record<string, unknown>;
}
