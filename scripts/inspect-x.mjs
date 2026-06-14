import { ApifyClient } from "apify-client";
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const actor = process.env.APIFY_X_ACTOR || "apidojo/tweet-scraper";

for (const handle of ["FirstWeFeast", "HeatonistNYC"]) {
  console.log(`\n=== twitterHandles:["${handle}"] ===`);
  try {
    const run = await client.actor(actor).call({ twitterHandles: [handle], maxItems: 8, sort: "Latest" });
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 8 });
    console.log("status:", run?.status, "| usd:", run?.usageTotalUsd, "| items:", items.length);
    const t = items.find((x) => !x.noResults) || items[0];
    if (t && !t.noResults) {
      console.log("keys:", Object.keys(t).slice(0, 30).join(", "));
      console.log("mapped:", JSON.stringify({
        id: t.id ?? t.id_str ?? t.tweetId, url: t.url ?? t.twitterUrl,
        text: (t.text ?? t.fullText ?? "").slice(0, 50),
        likes: t.likeCount ?? t.favoriteCount, retweets: t.retweetCount,
        replies: t.replyCount, views: t.viewCount, author: t.author?.userName ?? t.userName,
      }, null, 2));
    } else {
      console.log("-> noResults / empty:", JSON.stringify(items[0] ?? null).slice(0, 120));
    }
  } catch (e) {
    console.log("FAILED:", e.message);
  }
}
