import type { Source } from "@/lib/types";
import type { FetchedItem, SampleMetrics, SourceAdapter } from "./types";
import { pick, runActor, toNum } from "./apify";

/**
 * X / Twitter via Apify (default actor: xquik/x-tweet-scraper — runs on the
 * Apify free tier, unlike apidojo/tweet-scraper which requires a paid Apify
 * plan). Official X API is paid; this scrapes public tweets. Returns SNAPSHOTs;
 * the workflow re-samples over time.
 *
 * NOTE: actor input/output schemas vary by version — mapping is best-effort.
 */

function actor() {
  return process.env.APIFY_X_ACTOR || "xquik/x-tweet-scraper";
}

function metricsFromTweet(t: any): SampleMetrics {
  return {
    likes: toNum(pick(t, "likeCount", "favoriteCount", "likes")),
    comments: toNum(pick(t, "replyCount", "replies")),
    shares: toNum(pick(t, "retweetCount", "retweets")),
    views: toNum(pick(t, "viewCount", "views", "impressionCount")),
    raw: t,
  };
}

function itemFromTweet(t: any): FetchedItem {
  const author =
    pick<string>(t, "userName", "username") ||
    pick<string>(t?.author, "userName", "username", "screen_name");
  return {
    external_id: String(pick(t, "id", "id_str", "tweetId") ?? ""),
    url: pick<string>(t, "url", "twitterUrl"),
    author,
    title: undefined,
    body: pick<string>(t, "text", "fullText", "full_text"),
    posted_at: (() => {
      const c = pick<string>(t, "createdAt", "created_at");
      return c ? new Date(c).toISOString() : undefined;
    })(),
    metrics: metricsFromTweet(t),
  };
}

export const xAdapter: SourceAdapter = {
  platform: "x",

  async resolveHandle(source) {
    if (source.kind !== "account") return { raw: {} };
    try {
      const handle = source.handle.replace(/^@/, "");
      const items = await runActor(actor(), {
        twitterHandles: [handle],
        maxItems: 1,
      });
      const t = items[0];
      const followers = toNum(
        pick(t, "followers") ?? pick(t?.author, "followers", "followersCount")
      );
      return { followers, raw: { handle } };
    } catch {
      return null;
    }
  },

  async fetchItems(source: Source, opts) {
    const max = Math.min(opts.limit, 50);
    let input: Record<string, unknown>;
    if (source.kind === "account") {
      input = { twitterHandles: [source.handle.replace(/^@/, "")], maxItems: max };
    } else {
      // search_term or hashtag
      input = { searchTerms: [source.handle], maxItems: max };
    }
    const items = await runActor(actor(), input);
    // The actor emits a {noResults:true} sentinel for empty searches — drop it.
    return items
      .filter((t) => !pick(t, "noResults"))
      .map(itemFromTweet)
      .filter((it) => it.external_id);
  },

  async sampleItems(items) {
    // Re-fetch the same tweets by URL to capture updated engagement.
    const urls = items.map((it) => it.url).filter(Boolean) as string[];
    if (urls.length === 0) return {};
    const results = await runActor(actor(), {
      startUrls: urls.map((url) => ({ url })),
      maxItems: urls.length,
    });
    const out: Record<string, SampleMetrics> = {};
    for (const t of results) {
      if (t?.noResults) continue;
      const id = String(pick(t, "id", "id_str", "tweetId") ?? "");
      if (id) out[id] = metricsFromTweet(t);
    }
    return out;
  },
};
