import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

// 1. Inspect the two actor runs: which fields carry cost?
const runs = {
  "tweet-scraper": "9Z24JeUWcxvnCocwx",
  "instagram-scraper": "7Ce6Jc1T1L4wl8VWQ",
};
for (const [name, id] of Object.entries(runs)) {
  const run = await client.run(id).get();
  console.log(`\n=== ${name} run ${id} ===`);
  console.log("status:", run?.status);
  const costish = {};
  for (const k of Object.keys(run || {})) {
    if (/usage|cost|usd/i.test(k)) costish[k] = run[k];
  }
  console.log("cost-ish fields:", JSON.stringify(costish));
  console.log("has usage obj:", JSON.stringify(run?.usage || null));
  // dataset sample
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });
  console.log("dataset count field defaultDatasetId:", run.defaultDatasetId);
  if (items[0]) {
    console.log(`first item keys (${name}):`, Object.keys(items[0]).slice(0, 40).join(", "));
  } else {
    console.log(`first item: NONE (empty dataset)`);
  }
}

// 2. Reddit public JSON: current UA vs browser UA
const ua = process.env.REDDIT_USER_AGENT || "signalos/0.1";
for (const [label, headers] of [
  ["current UA", { "User-Agent": ua }],
  ["browser UA", { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" }],
]) {
  try {
    const r = await fetch("https://www.reddit.com/r/hotsauce/hot.json?limit=2", { headers });
    console.log(`\nReddit public [${label}]: HTTP ${r.status}`);
  } catch (e) {
    console.log(`\nReddit public [${label}]: ERROR ${e.message}`);
  }
}
