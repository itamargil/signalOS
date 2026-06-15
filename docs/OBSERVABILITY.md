# Observability

A core requirement: **everything the agent does is recorded and inspectable.** Three
complementary streams — LLM calls, costs, and a human-readable activity feed — all
per-run and surfaced inline in the dashboard.

## 1. LLM logging (every model call)
`src/lib/llm/client.ts` is the **single choke point** to Anthropic. Its `complete()`:
- sends the request,
- persists an `llm_calls` row with the full system prompt, input messages, raw
  output, flattened text, stop reason, token counts, latency, and computed cost,
- emits an `activity` line, and records a `cost_events` row.

Because nothing else calls Anthropic, **no model output can ever be ephemeral.**
Pricing is a small editable table in this file (per-million-token rates by model
substring). Surfaced at `/logs` and inline in the run page's "LLM calls" section,
each row expandable to the full prompt/response with a timestamp.

> Rule: never call the Anthropic SDK directly anywhere else. Route through `complete()`.

## 2. Cost ledger
`cost_events` is one unified ledger across providers (`anthropic`, `apify`, …).
`src/lib/cost.ts` provides `recordCost()`.

- **LLM costs** are recorded inside the logged client (explicit `runId`/`ideaId`).
- **Apify costs** are recorded inside `runActor()` — it re-fetches the actor run to
  read `usageTotalUsd` (the value isn't reliably on the `.call()` return).

### Attribution gotcha (important)
Apify runs happen deep in the adapters, which don't receive `runId`. Attribution uses
an **AsyncLocalStorage** context (`runWithCostCtx`). This context **does not survive
Inngest's step boundary**, so it must be established **inside each scraping step** via
the `withCost(...)` wrapper in the workflow — not once around the whole function.
Surfaced at `/costs` (by provider, by idea, total) and inline per-run.

## 3. Activity feed + live tail
`src/lib/activity.ts` writes human-readable `activity` rows (`type`, `message`).
Steps log liberally — stage changes, each fetch, each actor run, each sample,
analysis/report, errors.

- `src/components/LiveTail.tsx` is a terminal-style stream that polls
  `GET /api/runs/[id]/activity?since=…` every ~1.5s and appends new lines, color-coded
  by type, with a "live" indicator while the run is active.
- `src/components/AutoRefresh.tsx` soft-refreshes the whole run page while the agent
  is working toward the next gate, so results and the next gate appear without a
  manual refresh. It pauses while a gate awaits the user.

## Where it shows up in the UI
| Surface | File | Shows |
|---|---|---|
| Run console sections | `src/app/runs/[id]/page.tsx` | Report, Sources, **LLM calls**, **Costs** (collapsible) + live tail |
| Global LLM log | `src/app/logs/page.tsx` | Every call across runs, with timestamps |
| Global costs | `src/app/costs/page.tsx` | Spend by provider / by idea / total |
| Next-step preview | `src/components/NextStepPlan.tsx`, `src/lib/plan.ts` | What will run next: tools, est. runtime, est. cost |

## Design intent
The operator should never wonder "what did it just do, what did it cost, and what's
about to happen." Those three questions map to the activity feed, the cost ledger,
and the next-step plan, respectively.
