# SignalOS — Documentation Index

SignalOS is a **manual, step-by-step market-signal research console**. You feed it
a product idea; you then drive each research step yourself — review the prompt or
scraper that will run, run it, see the results, advance — until a decision-ready
**signal report** is produced.

These docs are written so that a competent engineer **or an AI agent** can rebuild,
extend, or operate the system. They describe *intent and structure*, with file
references and diagrams, and deliberately avoid copy-paste code so you reason from
the architecture rather than mimic snippets.

## Read in this order

| Doc | What it covers |
|-----|----------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, tech stack, components, data flow, directory map |
| [WORKFLOW.md](WORKFLOW.md) | The manual step-runner state machine, gates, resume mechanism, recovery |
| [DATA-MODEL.md](DATA-MODEL.md) | Supabase schema, tables, relationships, RLS posture |
| [SOURCES.md](SOURCES.md) | The source-adapter pattern; Reddit/X/Instagram; adding a platform |
| [OBSERVABILITY.md](OBSERVABILITY.md) | LLM logging, cost ledger, activity feed, the live tail |
| [EXTENDING.md](EXTENDING.md) | How to add a source, a step/gate, or swap a provider (upgrade guide) |
| [DECISIONS.md](DECISIONS.md) | Hard-won lessons & non-obvious constraints — read before changing anything |

## Operational docs
| Doc | What it covers |
|-----|----------------|
| [deploy.md](deploy.md) | Deploying to Vercel + Inngest Cloud (and the free-tier path) |
| [reddit-api-application.md](reddit-api-application.md) | Applying for official Reddit Data API access (it's gated now) |
| [google-apis.md](google-apis.md) | **Planned (not built):** an SEO signal source via Google Trends / Apify |
| [privacy-policy.md](privacy-policy.md) | Hostable privacy policy (needed for the API applications) |

## One-paragraph mental model
A **run** is a state machine executed by a durable [Inngest](https://www.inngest.com)
function. Between every meaningful step it **pauses at a "gate"** and waits for you.
The Next.js dashboard renders the current gate (an editable prompt, or a scraper
config), you act, an API route emits an event, and Inngest resumes the function to
run exactly that one step — then pauses at the next gate. Data lives in Supabase;
the model is Anthropic; scraping is via Apify. Everything the agent does is logged.
