# Decisions & Gotchas

Hard-won constraints and non-obvious choices. **Read this before changing
infrastructure** — most of these were discovered the painful way and will silently
bite a rebuild.

## Model (Anthropic)
- **`claude-opus-4-8` rejects the `temperature` parameter** (400 "temperature is
  deprecated for this model"). The logged client omits it unless explicitly passed;
  don't add a default temperature.
- **Generous `maxTokens` per LLM step.** The proposed-sources / analysis / report
  JSON can be large; too small a cap truncates the output → JSON won't parse → the
  step fails. Discovery/analysis/report use 8k/6k/8k. If you add platforms or data,
  keep headroom. Discovery also *recovers* from a parse failure by re-opening its
  gate rather than dying.

## Inngest
- **Local dev needs no keys.** Attaching an event key flips the SDK into *cloud
  mode*, so the client only sets a key when `NODE_ENV==='production'`. Symptom of
  getting this wrong: `inngest.send` fails with "API Error: 200 undefined" locally.
- **Production = Inngest Cloud.** The local `inngest dev` server is local-only. In
  prod, connect the Inngest Vercel integration (it sets the signing/event keys and
  registers `/api/inngest`).
- **Each step is one serverless invocation** — it must fit the host's function
  timeout. That's why fetch is split **per source** and `maxDuration` is set on the
  inngest route. Slow scrapes favor a persistent host (Render free) or Vercel Pro.
- **AsyncLocalStorage does not survive a step boundary.** Cost-attribution context
  must be set *inside* each scraping step (`withCost`), not once around the function.
- **Deterministic step IDs.** Loops must encode an attempt/round counter in the ID.

## Apify (scraping)
- **`usageTotalUsd` isn't reliably on the `.call()` return** — re-fetch the run to
  read it, else costs record as $0.
- **Free-tier actor compatibility matters.** `apidojo/tweet-scraper` blocks free-plan
  users ("You cannot use the API with the Free Plan"); use `xquik/x-tweet-scraper`
  for X. For Reddit, `trudax/reddit-scraper-lite` returns posts but **no engagement
  counts**, and the full `trudax/reddit-scraper` requires a monthly rental — use
  `harshmaur/reddit-scraper` (pay-per-event, includes upvotes/comments + velocity).
- Actors return **snapshots**, not time series. Re-sampling + `metrics.ts` produces
  velocity.

## Reddit data access (as of 2026)
- Reddit's **Responsible Builder Policy (Nov 2025) closed self-service API keys**;
  new OAuth access requires manual pre-approval (commercial/research use is often
  rejected or pushed to ~$10k/mo enterprise). The public `.json` endpoints **403 since
  May 2026**. So the default is **Apify**; the official OAuth path is wired but gated.
- **Devvit (developers.reddit.com) is NOT the data API** — it builds apps that run
  *inside* Reddit, not an external data feed. Its keys don't grant listing access.

## Next.js
- **Supabase queries must bypass the Next fetch cache.** The server client passes a
  `cache: 'no-store'` fetch; without it, a list query cached while empty keeps serving
  stale/empty results (symptom: new ideas don't appear without a hard refresh).
- Data pages use `export const dynamic = 'force-dynamic'`.

## Supabase / security
- **RLS is enabled with no policies** — denies anon/authenticated, while the
  server-only service-role key bypasses it. This secures the public anon key without
  breaking the app (which is entirely server-side). Add real policies before
  multi-user.
- Run migrations via the Supabase SQL editor or the Supabase MCP. A `HEAD`-count
  existence check gives false positives on missing tables — use a real `select` to
  verify a table exists (see `scripts/check-db.mjs`).

## Product decisions
- **Manual step-runner is the only mode.** Every step gates; the agent never runs
  ahead. An "auto-run" toggle is intentionally deferred (the gate machinery stays as
  the substrate — see [EXTENDING.md](EXTENDING.md)).
- **Velocity over raw counts.** The signal is whether engagement is *accelerating*,
  which is why the snapshot/re-sample model exists.
- **One idea = one run** in the current model (the API creates a fresh idea+run per
  submission).
- **SEO source is planned, not built.** A prior implementation attempt was removed to
  keep the codebase coherent; the design + the Google Trends API application live in
  [google-apis.md](google-apis.md). Re-add it via the platform-extension steps.
