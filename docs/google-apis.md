# SEO / Google data — providers & native-API migration

> **STATUS: PLANNED — not implemented.** Design for a future SEO signal source
> (Phase D). A prior implementation attempt was removed to keep the codebase
> coherent; re-add it via the platform steps in [EXTENDING.md](EXTENDING.md). The
> Google Trends API application answer at the bottom is ready to submit.

The SEO signal source would sit behind a **provider interface** so it can start on
Apify and swap to native Google APIs once approved — the same pattern as the Reddit
adapter (Apify now → official OAuth later, zero rework).

## Provider abstraction (how we keep it swappable)

```
SeoProvider (interface)
  trends(keyword)  -> interest-over-time, related + rising queries, regional interest
  volume(keyword)  -> absolute monthly search volume, competition, CPC

Implementations:
  apify   (default) -> apify/google-trends-scraper  +  a search-volume actor
  google  (later)   -> Google Trends API            +  Google Ads API (Keyword Planner)
```

Selection is env-driven (like Reddit): if Google credentials are present, use the
native provider; else Apify. Both normalize to the **same record shape**, so the
adapter, analysis, and report code never change.

Env knobs (planned):
```
SEO_PROVIDER=apify            # or "google" once approved
GOOGLE_TRENDS_API_KEY=        # native Trends API (application required)
GOOGLE_ADS_DEVELOPER_TOKEN=   # native search volume via Keyword Planner
GOOGLE_ADS_*                  # OAuth client/refresh for Ads API
```

## The three Google APIs — what each is for
- **Google Trends API** — interest-over-time + related/rising queries. Direct
  replacement for the Apify Trends actor. **Requires application/approval** (answer
  below). Native = cleaner data, no scraping.
- **Google Ads API (Keyword Planner)** — real absolute search volume, competition,
  CPC. Replaces the Apify volume actor. Needs a Google Ads account + developer
  token (basic access).
- **Search Console API** — *your own verified site's* search performance (queries,
  impressions, clicks). NOT general keyword research — it only covers domains you
  own. Relevant in **Phase 2** to measure the landing page's own SEO once it's live.

---

## Google Trends API — application answer (copy-paste)

> *Question: Provide a description of what you intend to do with the Google Trends
> API. ... how you would use this data (research paper / brand awareness / news).*

We operate SignalOS, an internal market-research tool that evaluates early-stage
consumer product ideas before investing in building them. For each idea, we use
Google Trends data to measure real search demand and its momentum across a small,
curated set of relevant keywords.

Specifically, we use the API to:
- **Assess demand momentum** — pull interest-over-time (typically the trailing 12
  months) for an idea's core queries to determine whether search interest is
  rising, flat, or declining. A rising trend is a positive signal to prototype;
  a declining one is a reason to pass.
- **Discover adjacent demand** — read related and "rising" queries to surface
  emerging sub-niches and angles we hadn't considered.
- **Prioritize markets** — use regional interest to understand where demand is
  concentrated geographically.

The Trends data is combined with social listening (public Reddit, X, and Instagram
signals) into an internal written "signal report" that a single operator uses to
decide which product ideas advance to an MVP. This is analytical/decision-support
use, analogous to using Trends to gauge market interest for a research memo.

Scope is low-volume and on-demand: a research run queries roughly 10–30 keywords
for one idea, sampled a handful of times — not a continuous, high-frequency
pipeline. We do not redistribute, resell, or publicly republish raw Trends data;
outputs are aggregated internal insights and charts. We comply with the API terms,
including attribution and all usage restrictions.

**Concrete example:** For the idea "a monthly subscription box of small-batch
regional hot sauces," we would query terms like "hot sauce subscription," "small
batch hot sauce," and "hot sauce gift," review their 12-month interest trends and
rising related queries, and judge whether search demand is growing before
committing to build the product.
