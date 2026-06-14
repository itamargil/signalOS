import type { Platform } from "@/lib/types";
import type { SourceAdapter } from "./types";
import { redditAdapter } from "./reddit";
import { redditApifyAdapter } from "./apify-reddit";
import { xAdapter } from "./apify-x";
import { instagramAdapter } from "./apify-instagram";

/**
 * Reddit source selection:
 *   - official OAuth creds present       → official Data API adapter
 *   - else an Apify token is present     → Apify scraper (current default,
 *     since Reddit closed self-service API access)
 *   - else                               → official adapter's public fallback
 * So once a Responsible-Builder approval lands and you set REDDIT_CLIENT_ID/
 * SECRET, Reddit flips back to the official API with no code change.
 */
function pickReddit(): SourceAdapter {
  const hasOAuth = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
  if (hasOAuth) return redditAdapter;
  if (process.env.APIFY_TOKEN) return redditApifyAdapter;
  return redditAdapter;
}

const REGISTRY: Record<Platform, SourceAdapter> = {
  reddit: pickReddit(),
  x: xAdapter,
  instagram: instagramAdapter,
};

export function adapterFor(platform: Platform): SourceAdapter {
  const a = REGISTRY[platform];
  if (!a) throw new Error(`No adapter for platform: ${platform}`);
  return a;
}

export const ALL_PLATFORMS: Platform[] = ["reddit", "x", "instagram"];
export type { SourceAdapter } from "./types";
