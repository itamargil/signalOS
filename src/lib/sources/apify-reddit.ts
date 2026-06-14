import type { Source } from "@/lib/types";
import type { FetchedItem, SampleMetrics, SourceAdapter } from "./types";
import { pick, runActor, toNum } from "./apify";

/**
 * Reddit via Apify. Used because Reddit killed self-service API access
 * (Responsible Builder Policy, Nov 2025) and 403'd the public .json
 * endpoints (May 2026). Default actor: harshmaur/reddit-scraper — pay-per-
 * event, returns upvotes/comments + pre-computed engagement velocity.
 *
 * When official OAuth credentials are approved, the registry switches Reddit
 * back to the official adapter automatically (see ./index.ts).
 */

function actor() {
  return process.env.REDDIT_APIFY_ACTOR || "harshmaur/reddit-scraper";
}

function subredditUrl(handle: string) {
  return `https://www.reddit.com/${handle.replace(/^\//, "")}/`; // handle e.g. "r/hotsauce"
}

function metricsFromPost(p: any): SampleMetrics {
  return {
    score: toNum(pick(p, "score", "upVotes")),
    comments: toNum(pick(p, "commentsCount", "numberOfComments")),
    raw: {
      upvoteRatio: pick(p, "upvoteRatio"),
      subredditSubscribers: pick(p, "subredditSubscribers"),
      scorePerHour: pick(p, "scorePerHour"),
      commentsPerHour: pick(p, "commentsPerHour"),
      isHighEngagement: pick(p, "isHighEngagement"),
    },
  };
}

function externalId(p: any): string {
  return (
    (pick<string>(p, "parsedId") as string) ||
    String(pick(p, "id") ?? "").replace(/^t3_/, "")
  );
}

function itemFromPost(p: any): FetchedItem {
  const created = pick<string>(p, "createdAt", "created");
  return {
    external_id: externalId(p),
    url: pick<string>(p, "postUrl", "url"),
    author: pick<string>(p, "authorName", "username"),
    title: pick<string>(p, "title"),
    body: pick<string>(p, "body"),
    posted_at: created ? new Date(created).toISOString() : undefined,
    metrics: metricsFromPost(p),
  };
}

const onlyPosts = (items: any[]) =>
  items.filter((i) => !i.dataType || i.dataType === "post");

export const redditApifyAdapter: SourceAdapter = {
  platform: "reddit",

  async resolveHandle() {
    // Subreddit subscriber counts ride along in each post's metrics; skip the
    // extra (paid) actor run here.
    return { raw: {} };
  },

  async fetchItems(source: Source, opts) {
    const max = Math.min(opts.limit, 50);
    let input: Record<string, unknown>;
    if (source.kind === "subreddit") {
      input = {
        subredditUrls: [subredditUrl(source.handle)],
        searchSort: "top",
        searchTime: "month",
        maxPostsCount: max,
        crawlCommentsPerPost: false,
        maxCommentsPerPost: 0,
      };
    } else if (source.kind === "search_term") {
      input = {
        searchTerms: [source.handle],
        searchPosts: true,
        searchComments: false,
        searchCommunities: false,
        searchSort: "relevance",
        searchTime: "month",
        maxPostsCount: max,
        crawlCommentsPerPost: false,
        maxCommentsPerPost: 0,
      };
    } else if (source.kind === "account") {
      input = {
        startUrls: [{ url: `https://www.reddit.com/user/${source.handle.replace(/^u\/|^\//, "")}/` }],
        maxPostsCount: max,
        crawlCommentsPerPost: false,
        maxCommentsPerPost: 0,
      };
    } else {
      return [];
    }
    const items = await runActor(actor(), input);
    return onlyPosts(items)
      .map(itemFromPost)
      .filter((it) => it.external_id);
  },

  async sampleItems(items) {
    const urls = items.map((it) => it.url).filter(Boolean) as string[];
    if (urls.length === 0) return {};
    const results = await runActor(actor(), {
      startUrls: urls.map((url) => ({ url })),
      maxPostsCount: urls.length,
      crawlCommentsPerPost: false,
      maxCommentsPerPost: 0,
    });
    const out: Record<string, SampleMetrics> = {};
    for (const p of onlyPosts(results)) {
      const id = externalId(p);
      if (id) out[id] = metricsFromPost(p);
    }
    return out;
  },
};
