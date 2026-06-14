import type { Source } from "@/lib/types";
import type { FetchedItem, SampleMetrics, SourceAdapter } from "./types";
import { pick, runActor, toNum } from "./apify";

/**
 * Instagram via Apify. No official API exists for tracking arbitrary
 * accounts, so this drives a scraping actor (default: apify/instagram-scraper).
 * Each run returns a SNAPSHOT; the workflow re-samples over time.
 *
 * NOTE: actor input/output schemas vary by version. Field mapping below is
 * best-effort with fallbacks; tune to your chosen actor if needed.
 */

function actor() {
  return process.env.APIFY_INSTAGRAM_ACTOR || "apify/instagram-scraper";
}

function profileUrl(handle: string) {
  const h = handle.replace(/^@/, "").trim();
  return `https://www.instagram.com/${h}/`;
}
function hashtagUrl(tag: string) {
  const t = tag.replace(/^#/, "").trim();
  return `https://www.instagram.com/explore/tags/${t}/`;
}

function metricsFromPost(p: any): SampleMetrics {
  return {
    likes: toNum(pick(p, "likesCount", "likes")),
    comments: toNum(pick(p, "commentsCount", "comments")),
    views: toNum(pick(p, "videoViewCount", "videoPlayCount", "views")),
    raw: p,
  };
}

function itemFromPost(p: any): FetchedItem {
  const shortcode = pick<string>(p, "shortCode", "shortcode", "code");
  const ts = pick<string>(p, "timestamp", "takenAt");
  return {
    external_id: String(pick(p, "id", "shortCode", "shortcode") ?? shortcode ?? ""),
    url: pick<string>(p, "url") || (shortcode ? `https://www.instagram.com/p/${shortcode}/` : undefined),
    author: pick<string>(p, "ownerUsername", "ownerFullName"),
    title: undefined,
    body: pick<string>(p, "caption"),
    posted_at: ts ? new Date(ts).toISOString() : undefined,
    metrics: metricsFromPost(p),
  };
}

export const instagramAdapter: SourceAdapter = {
  platform: "instagram",

  async resolveHandle(source) {
    if (source.kind !== "account") return { raw: {} };
    try {
      const items = await runActor(actor(), {
        directUrls: [profileUrl(source.handle)],
        resultsType: "details",
        resultsLimit: 1,
      });
      const p = items[0];
      if (!p) return null;
      return {
        followers: toNum(pick(p, "followersCount", "followers")),
        raw: { fullName: pick(p, "fullName"), verified: pick(p, "verified") },
      };
    } catch {
      return null;
    }
  },

  async fetchItems(source: Source, opts) {
    const url =
      source.kind === "hashtag" ? hashtagUrl(source.handle) : profileUrl(source.handle);
    const items = await runActor(actor(), {
      directUrls: [url],
      resultsType: "posts",
      resultsLimit: Math.min(opts.limit, 50),
    });
    return items.map(itemFromPost).filter((it) => it.external_id);
  },

  async sampleItems(items) {
    const urls = items.map((it) => it.url).filter(Boolean) as string[];
    if (urls.length === 0) return {};
    const results = await runActor(actor(), {
      directUrls: urls,
      resultsType: "posts",
      resultsLimit: urls.length,
    });
    const out: Record<string, SampleMetrics> = {};
    for (const p of results) {
      const id = String(pick(p, "id", "shortCode", "shortcode") ?? "");
      if (id) out[id] = metricsFromPost(p);
    }
    return out;
  },
};
