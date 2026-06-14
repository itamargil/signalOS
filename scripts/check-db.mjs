import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "ideas",
  "runs",
  "sources",
  "tracked_items",
  "metric_samples",
  "approvals",
  "llm_calls",
  "activity",
  "reports",
  "cost_events",
];

// NOTE: use a real row select (not head:true count) — a HEAD request against
// a missing table returns 404 with an empty body, which the client reports as
// no-error/null-count, i.e. a false positive.
let missing = 0;
for (const t of tables) {
  const { error } = await db.from(t).select("id").limit(1);
  if (error) {
    console.log(`✗ ${t.padEnd(16)} ${error.message}`);
    missing++;
  } else {
    console.log(`✓ ${t.padEnd(16)} reachable`);
  }
}
process.exit(missing ? 1 : 0);
