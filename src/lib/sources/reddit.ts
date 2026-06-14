import type { Source } from "@/lib/types";
import type { FetchedItem, SampleMetrics, SourceAdapter } from "./types";

/**
 * Reddit — read-only research. Three auth modes, auto-selected:
 *   1. OAuth (REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET) — highest rate limits,
 *      best for production. Create a "script" app at reddit.com/prefs/apps.
 *   2. Bearer key (REDDIT_API_KEY) — used as a bearer token against the
 *      OAuth API, if you have one that works there.
 *   3. Public JSON (no creds) — reddit.com/*.json endpoints, unauthenticated.
 *      Fine for low-volume research; tighter rate limits, may be blocked from
 *      some datacenter IPs in production.
 *
 * NOTE: developers.reddit.com (Devvit) is Reddit's app-building platform and is
 * NOT the data API — its keys won't grant listing/search access here.
 */

const OAUTH_BASE = "https://oauth.reddit.com";
const PUBLIC_BASE = "https://www.reddit.com";
let _token: { value: string; expiresAt: number } | null = null;

function ua() {
  return process.env.REDDIT_USER_AGENT || "signalos/0.1";
}

function mode(): "oauth" | "key" | "public" {
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) return "oauth";
  if (process.env.REDDIT_API_KEY) return "key";
  return "public";
}

async function oauthToken(): Promise<string> {
  if (_token && Date.now() < _token.expiresAt - 60_000) return _token.value;
  const id = process.env.REDDIT_CLIENT_ID!;
  const secret = process.env.REDDIT_CLIENT_SECRET!;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua(),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  _token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return _token.value;
}

/** Insert `.json` before any query string for public endpoints. */
function toPublic(path: string): string {
  const [p, q] = path.split("?");
  return `${p}.json${q ? `?${q}` : ""}`;
}

async function api(path: string): Promise<any> {
  const m = mode();
  let url: string;
  const headers: Record<string, string> = { "User-Agent": ua() };

  if (m === "oauth") {
    url = `${OAUTH_BASE}${path}`;
    headers.Authorization = `Bearer ${await oauthToken()}`;
  } else if (m === "key") {
    url = `${OAUTH_BASE}${path}`;
    headers.Authorization = `Bearer ${process.env.REDDIT_API_KEY}`;
  } else {
    url = `${PUBLIC_BASE}${toPublic(path)}`;
  }

  const res = await fetch(url, { headers });
  // If a provided key is rejected, fall back to public endpoints once.
  if (!res.ok && m === "key" && (res.status === 401 || res.status === 403)) {
    const pub = await fetch(`${PUBLIC_BASE}${toPublic(path)}`, {
      headers: { "User-Agent": ua() },
    });
    if (!pub.ok) throw new Error(`Reddit API ${path} -> ${pub.status} (public fallback)`);
    return pub.json();
  }
  if (!res.ok) throw new Error(`Reddit API ${path} -> ${res.status}`);
  return res.json();
}

function metricsFromPost(d: any): SampleMetrics {
  return {
    score: d.score,
    comments: d.num_comments,
    raw: { upvote_ratio: d.upvote_ratio, subreddit: d.subreddit, over_18: d.over_18 },
  };
}

function itemFromPost(d: any): FetchedItem {
  return {
    external_id: d.id,
    url: `https://reddit.com${d.permalink}`,
    author: d.author,
    title: d.title,
    body: d.selftext || "",
    posted_at: new Date(d.created_utc * 1000).toISOString(),
    metrics: metricsFromPost(d),
  };
}

export const redditAdapter: SourceAdapter = {
  platform: "reddit",

  async resolveHandle(source) {
    try {
      if (source.kind === "subreddit") {
        const sub = source.handle.replace(/^r\//, "");
        const j = await api(`/r/${encodeURIComponent(sub)}/about`);
        return { followers: j.data?.subscribers, raw: { name: j.data?.display_name } };
      }
      if (source.kind === "account") {
        const u = source.handle.replace(/^u\/|^\//, "");
        const j = await api(`/user/${encodeURIComponent(u)}/about`);
        return {
          score: j.data?.total_karma,
          raw: { link_karma: j.data?.link_karma, comment_karma: j.data?.comment_karma },
        };
      }
      return { raw: {} };
    } catch {
      return null;
    }
  },

  async fetchItems(source: Source, opts) {
    const limit = Math.min(opts.limit, 100);
    let path: string;
    if (source.kind === "subreddit") {
      const sub = source.handle.replace(/^r\//, "");
      path = `/r/${encodeURIComponent(sub)}/hot?limit=${limit}`;
    } else if (source.kind === "search_term") {
      path = `/search?q=${encodeURIComponent(source.handle)}&sort=relevance&t=month&limit=${limit}`;
    } else if (source.kind === "account") {
      const u = source.handle.replace(/^u\/|^\//, "");
      path = `/user/${encodeURIComponent(u)}/submitted?limit=${limit}`;
    } else {
      return [];
    }
    const j = await api(path);
    const children = j.data?.children ?? [];
    return children
      .filter((c: any) => c.kind === "t3")
      .map((c: any) => itemFromPost(c.data));
  },

  async sampleItems(items) {
    const out: Record<string, SampleMetrics> = {};
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);
      const ids = batch.map((it) => `t3_${it.external_id}`).join(",");
      const j = await api(`/api/info?id=${ids}`);
      for (const c of j.data?.children ?? []) {
        if (c.kind === "t3") out[c.data.id] = metricsFromPost(c.data);
      }
    }
    return out;
  },
};
