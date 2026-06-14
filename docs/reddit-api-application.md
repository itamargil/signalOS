# Reddit Data API — Access Request Package

This is everything needed to apply for official Reddit Data API access under the
**Responsible Builder Policy** (self-service key creation was discontinued
Nov 2025; access is now manual pre-approval).

## Where to submit
Reddit **Developer Support form** (Help Center → "Request Data API access" /
Developer Support). You must first agree to the Responsible Builder Policy,
Developer Terms, and Data API Terms. Target response ~7 days; in practice 1–4 weeks.

> ⚠️ Reality check: small **commercial** analytics/market-research tools are
> frequently rejected and steered to Enterprise (~$10k/mo). Maximize odds by
> framing this honestly and narrowly: low volume, public data only, aggregate
> insights, strict retention. Submit ONE request for this one use case (multiple
> requests for the same use case are prohibited).

---

## Fill-in-the-blanks (replace before submitting)
- **Developer / company name:** Itamar Gil
- **Contact email:** itamargil8@gmail.com
- **App name:** SignalOS
- **App website / privacy policy URL:** https://www.igb.life/signalos/privacy (host `privacy-policy.md`)
- **Reddit account username:** u/Pure-Spray-5462
- **OAuth redirect URI:** https://www.igb.life/signalos/api/auth/reddit/callback

---

## Application answers

**1. What are you building?**
SignalOS is an early-stage internal market-research tool. For a given product
idea, it reads a small set of relevant public subreddits and public search
results to gauge genuine demand — what people ask for, complain about, and
recommend — and produces an aggregated written "signal report." It is used by a
single operator to decide which product ideas are worth prototyping.

**2. What Reddit data do you access, and how is it used?**
Public posts only (title, body, permalink, author handle, created time) plus
their public engagement counts (score/upvotes, comment count). We do **not**
access private messages, non-public content, or user PII beyond public usernames.
Data is used to compute aggregate signal (themes, pain points, engagement
velocity). Reports contain summaries and at most a few cited public permalinks —
never bulk reproductions of Reddit content.

**3. Scope (subreddits, volume).**
Narrow and on-demand. A typical research run reads ~5–10 subreddits and a few
search queries, pulling on the order of a few hundred posts total, sampled a
handful of times over a few days. There is no continuous firehose, no full-
subreddit archival, and no resale of data. Estimated volume: well under 1,000
requests/day, usually far less.

**4. Data storage & retention.**
We store only what's needed to compute a report: post identifiers, public metric
snapshots, and short excerpts. Raw post content is deleted within **48 hours** per
Reddit's requirement; only derived aggregate insights are retained. We honor
deletions — if content is removed from Reddit, our copy is purged on next sample.

**5. Will you display Reddit content publicly / commercially resell it?**
No reselling of Reddit data. Output is internal decision-support. Any public
landing pages built later reference only aggregate conclusions, not reproduced
Reddit content, and link back to Reddit permalinks where cited.

**6. Compliance.**
We agree to the Responsible Builder Policy, Developer Terms, and Data API Terms,
including rate limits, the 48-hour content-deletion rule, attribution, and the
prohibition on training foundation models on Reddit data without a separate
agreement.

---

## Developer Support form — answers (copy-paste)

**Q1 — What benefit/purpose will the bot/app have for Redditors?**

SignalOS is **strictly read-only**: it never posts, comments, votes, sends
messages, or modifies anything on Reddit, so it adds zero spam, zero automated
content, and zero moderation burden to the platform. Its purpose is to help a
builder understand what communities are genuinely asking for, complaining about,
and recommending, so that the products that get built reflect real, expressed
community needs instead of guesswork. The indirect benefit to Redditors is
better, more relevant products in the niches they care about. Because access is
read-only, low-volume, and on-demand (not a continuous firehose), the load on
Reddit is negligible. We do not resell Reddit data and do not train AI/foundation
models on it.

**Q2 — Detailed description of what the app does on Reddit (with examples).**

A single human operator enters a product idea. The app then:
1. Proposes a small set of relevant **public** subreddits and public search
   queries for that idea. **A human reviews and approves** that list before any
   data is fetched (human-in-the-loop gate) — nothing is accessed automatically.
2. For each approved subreddit/search, reads recent **public** posts: title,
   body text, permalink, public author handle, score/upvotes, comment count, and
   timestamp. It pulls top/relevant posts from roughly the last month, capped at
   a few dozen per source.
3. Re-reads those same posts a handful of times over a few days to measure
   **engagement velocity** (how quickly a post accrues upvotes/comments).
4. An LLM summarizes the aggregate signal — recurring themes, pain points, demand
   indicators, objections — into a written internal report that cites at most a
   few public permalinks. No bulk reproduction of Reddit content.

It performs **no writes of any kind** (no posting, commenting, voting, messaging,
or moderation).

*Worked example:* For the idea "a subscription box of small-batch regional hot
sauces," the operator approved r/hotsauce, r/HotPeppers, r/fermentation and
searches like "best hot sauce subscription." The app read a few hundred public
posts, sampled them twice over a day, and found that curation/pairing content
draws high engagement while generic maker self-promotion does not — concluding
demand was unproven and recommending a cheap demand test before building. Typical
volume is well under 1,000 requests/day, usually far less.

**Q3 — What is missing from Devvit that prevents building on that platform?**

Devvit apps run inside Reddit's own runtime and are scoped to subreddits where
they are installed (a moderator context). SignalOS does not fit that model:
- It is a **cross-platform** research tool that aggregates and compares signal
  across Reddit, X, and Instagram in a single report; Devvit cannot read or
  integrate non-Reddit sources.
- It must read **arbitrary public subreddits the operator does not moderate** and
  cannot install an app into — chosen fresh per research project.
- It runs an existing **external stack** (Next.js dashboard, Inngest durable
  workflows, Supabase storage, Anthropic LLM analysis) that cannot be hosted as
  an in-Reddit Devvit app.
- Its output is an **off-Reddit internal report for one operator**, not an
  in-subreddit experience delivered to Redditors.

In short, Devvit's in-subreddit, install-scoped, on-platform model can't support a
read-only, cross-platform, externally-hosted research pipeline.

**Q4 — Link to source code or platform that will access the API.**

> ⚠️ ACTION NEEDED: provide a real link before submitting — either the deployed
> dashboard (e.g. https://www.igb.life/signalos) or a GitHub repo (private is
> fine; offer read access on request). Reddit reviewers want something verifiable.

Reddit source adapter (the only code that touches the Reddit API):
`src/lib/sources/apify-reddit.ts` (and `src/lib/sources/reddit.ts` for the
official OAuth path). Repo / hosted app URL: ____________________

**Q5 — What subreddits do you intend to use the app in?**

It varies per research project: a **small, human-approved set (~5–10 public
subreddits)** chosen for each idea, never a blanket crawl. Representative set for
the current hot-sauce project: **r/hotsauce, r/HotPeppers, r/spicy,
r/fermentation, r/subscriptionboxes.** Other projects would use different niche
subreddits relevant to that specific idea, always public and always reviewed by a
human before any access.

**Q6 — Username operating the app (optional).**

u/Pure-Spray-5462

---

## After approval
Set the issued credentials in `.env.local`:
```
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```
The Reddit source adapter auto-switches from Apify to the official OAuth API —
no code change required (see `src/lib/sources/index.ts`).
