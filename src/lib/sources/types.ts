import type { Platform, Source } from "@/lib/types";

/** Normalized engagement snapshot returned by every adapter. */
export interface SampleMetrics {
  followers?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  score?: number;
  raw: Record<string, unknown>;
}

/** A content item pulled from a source, with its initial metric snapshot. */
export interface FetchedItem {
  external_id: string;
  url?: string;
  author?: string;
  title?: string;
  body?: string;
  posted_at?: string;
  metrics: SampleMetrics;
}

/**
 * Each platform implements this. Discovery of WHICH sources to use is
 * LLM-driven; the adapter validates them and pulls/re-samples data.
 */
export interface SourceAdapter {
  platform: Platform;

  /** Validate a proposed account/subreddit and return its current metrics, or null if not found. */
  resolveHandle(source: Pick<Source, "kind" | "handle">): Promise<SampleMetrics | null>;

  /** Pull current items for an approved source (listing, account posts, search results). */
  fetchItems(source: Source, opts: { limit: number }): Promise<FetchedItem[]>;

  /** Re-sample engagement for already-tracked items. Keyed by external_id. */
  sampleItems(
    items: { external_id: string; url?: string | null }[]
  ): Promise<Record<string, SampleMetrics>>;
}
