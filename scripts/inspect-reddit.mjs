import { ApifyClient } from "apify-client";
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const actor = "harshmaur/reddit-scraper";
const input = {
  subredditUrls: ["https://www.reddit.com/r/hotsauce/"],
  searchSort: "top",
  searchTime: "month",
  maxPostsCount: 6,
  crawlCommentsPerPost: false,
  maxCommentsPerPost: 0,
  includeNSFW: false,
};

console.log(`=== ${actor} ===`);
const run = await client.actor(actor).call(input);
console.log("status:", run?.status, "| usageTotalUsd:", run?.usageTotalUsd);
const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 20 });
console.log("items:", items.length);
const post = items.find((i) => (i.dataType ? i.dataType === "post" : true)) || items[0];
if (post) {
  console.log("ALL keys:", Object.keys(post).join(", "));
  console.log("engagement-ish:", JSON.stringify(
    Object.fromEntries(Object.entries(post).filter(([k]) =>
      /vote|score|comment|count|ratio|like|award|num/i.test(k)
    ))
  ));
}
