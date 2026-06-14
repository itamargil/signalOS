# Deploying SignalOS to Vercel

The app is build-verified and production-ready. Supabase is already cloud-hosted
with RLS enabled (server uses the service-role key, which bypasses RLS). The one
moving part for production is **Inngest** (the durable workflow engine), which
runs via Inngest Cloud instead of the local dev server.

## 1. Import the repo
1. Go to **https://vercel.com/new** (logged in as igbllc97@gmail.com).
2. Import the GitHub repo you pushed (`itamargil/<repo>`).
3. Framework preset auto-detects **Next.js**. Leave build/output settings default.
4. Don't deploy yet — add env vars first (next step).

## 2. Environment variables (Project → Settings → Environment Variables)
Copy these from your local `.env.local` (set for Production + Preview):

| Key | Notes |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase (safe — RLS blocks it) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only secret |
| `ANTHROPIC_API_KEY` | |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` |
| `APIFY_TOKEN` | |
| `REDDIT_APIFY_ACTOR` | `harshmaur/reddit-scraper` |
| `APIFY_X_ACTOR` | `xquik/x-tweet-scraper` |
| `APIFY_INSTAGRAM_ACTOR` | `apify/instagram-scraper` |
| `RESEND_API_KEY` | |
| `NOTIFY_EMAIL_TO` | itamargil8@gmail.com |
| `NOTIFY_EMAIL_FROM` | `SignalOS <onboarding@resend.dev>` |
| `APP_URL` | set to the Vercel prod URL once you have it (used in approval emails) |

Not needed yet: `REDDIT_CLIENT_ID/SECRET` (until official API approval),
`REDDIT_API_KEY`. Inngest keys are handled in step 4.

## 3. First deploy
Deploy. You'll get a URL like `https://signalos-xxxx.vercel.app`. Set `APP_URL`
to that URL and redeploy so approval emails link correctly.

## 4. Connect Inngest Cloud (this is what runs the research workflow)
The local `inngest dev` server does NOT run in production — Inngest Cloud does.
1. Install the **Inngest Vercel integration**:
   https://vercel.com/integrations/inngest → add it to this project.
   It auto-creates `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` env vars and
   registers your `/api/inngest` endpoint. (Our code reads those automatically in
   production.)
2. After the next deploy, open the Inngest dashboard → your app should sync and
   show the `research-run` function.
3. Create an idea on the live site — the workflow now runs in the cloud, pausing
   at the approval gates exactly like local.

## 5. Vercel plan note (important for the workflow)
Each Inngest step runs as one serverless invocation. Apify scrapes are slow, so
the route declares `maxDuration = 300` and fetches are split per-source.
- **Vercel Pro** (300s functions): recommended — everything fits comfortably.
- **Vercel Hobby** (60s cap): the dashboard works fully; most workflow steps fit,
  but a slow Reddit scrape (~60–90s) can exceed 60s. Inngest auto-retries, so it
  usually still completes, but Pro is the reliable choice for heavy runs.

## What works where
- **Dashboard** (view runs/reports/costs/logs, create ideas, approve gates): works
  on any plan.
- **Research workflow** (discovery → scrape → sample → report): needs Inngest Cloud
  connected (step 4); reliable on Vercel Pro.
