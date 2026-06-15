# SignalOS

Idea → **signal** → MVP pipeline. A **manual, step-by-step research console**: feed a
product idea, then drive each step yourself — review the prompt or scraper that will
run, run it, see the results, advance — until a decision-ready signal report is done.
Sources: Reddit, X, Instagram.

📚 **Full architecture & rebuild/upgrade docs: [docs/INDEX.md](docs/INDEX.md)**

Every model output — discovery, analysis, final report — is persisted and inspectable
in the **LLM Logs** view. Nothing the agent produces is ephemeral.

## Architecture

```
Next.js dashboard (Vercel)
  ├─ /api/ideas            create idea+run → fires Inngest "run/start"
  ├─ /api/approvals/[id]   your decision → fires "run/approval.decided"
  └─ /api/inngest          serves the durable workflow

Inngest  → research-run (manual step-runner — every step is a gate you run)
  discovery → fetch → sample(×N) → analysis → report

Supabase (Postgres)
  ideas, runs, sources, tracked_items, metric_samples (time series),
  approvals, llm_calls (full I/O log), activity, reports

Source adapters (pluggable)
  reddit  → official API (free)
  x       → Apify actor
  instagram → Apify actor
```

The agent only talks to the model through `src/lib/llm/client.ts`, which logs
every call to `llm_calls`. Sources are snapshot-based; the workflow re-samples on
a schedule and stores each point, so we compute **engagement velocity** ourselves.

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Supabase** — create a project, then run `supabase/migrations/0001_init.sql`
   in the SQL editor (or via the Supabase CLI). Copy the URL + anon + service
   role keys.

3. **Env** — `cp .env.example .env.local` and fill in:
   - Supabase URL + anon + **service role** key
   - `ANTHROPIC_API_KEY`
   - Reddit: create a "script" app at https://www.reddit.com/prefs/apps → client id/secret
   - `APIFY_TOKEN` (+ optionally override the actor ids)
   - `RESEND_API_KEY` + `NOTIFY_EMAIL_TO` (for approval/report emails)

4. **Run** (two terminals):
   ```bash
   npm run dev        # the app on http://localhost:3000
   npm run inngest    # Inngest dev server (runs the durable workflow locally)
   ```
   Open http://localhost:3000, submit an idea. For a fast end-to-end test set
   **window = 1 day, samples = 2** (the loop interval scales with the window;
   minimum sleep is clamped to 1 minute).

## Deploy (Vercel + Inngest Cloud)

- Push to Vercel; set the same env vars in the project.
- Connect the repo in Inngest Cloud; it auto-discovers `/api/inngest`.
- Add `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` and set `APP_URL` to the prod URL.

## Notes / next steps

- **Auth**: the MVP is single-user and server-side via the service role key. Add
  Supabase Auth + RLS before exposing it.
- **Apify field mapping** lives in `src/lib/sources/apify-*.ts` and is best-effort
  across actor versions — tune to whichever actors you settle on.
- **Phase 2** (landing-page + AI-influencer builder) bolts onto the same dashboard
  and `runs` model.
