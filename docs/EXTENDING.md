# Extending & Upgrading

Guidelines for the most common changes. These describe *what to touch and why*, not
exact code — reason from the existing patterns in the referenced files.

## Add a new source platform
Example: add an "seo" platform (a Google-Trends signal source — see
[google-apis.md](google-apis.md) for the planned design).

1. **Adapter** — implement `SourceAdapter` (`src/lib/sources/types.ts`) in a new file
   under `src/lib/sources/`. Map the provider's output into the normalized
   `FetchedItem` / `SampleMetrics` shapes. If it's an Apify actor, reuse `runActor()`
   from `apify.ts` (you get cost + activity logging for free).
2. **Register** it in `src/lib/sources/index.ts` (`adapterFor`). If the platform has
   multiple backends (like Reddit's oauth/apify/public), add a selector like
   `pickReddit()`.
3. **Type** — add the platform to the `Platform` union in `src/lib/types.ts`.
4. **Discovery** — teach the discovery prompt to propose this platform's sources
   (`src/lib/agent/discovery.ts`), including the right `kind` (e.g. `search_term`).
5. **Plan heuristics** — add a row to the `PLATFORM` map in `src/lib/plan.ts` (label,
   est. seconds, est. USD) so the next-step card shows it.
6. **UI** — the new-idea platform toggles live in `src/components/NewIdea.tsx`.

If a source returns a full time series already (Trends does), it doesn't need the
repeated Sample step — handle it as a one-shot in the adapter and note it in the plan.

## Add a new step / gate
The gate pattern (see [WORKFLOW.md](WORKFLOW.md)) is uniform:
1. **Open a gate** in `research-run.ts`: insert an `approvals` row with a new `stage`
   and an editable `payload`, set the run `awaiting_approval`, notify. (Reuse
   `openPromptGate` / `openSampleGate` as templates.)
2. **Wait** with `step.waitForEvent`, matched on `runId` + the new `stage`. Use a
   deterministic step ID.
3. **API** — handle the new `stage`/`action` in `src/app/api/approvals/[id]/route.ts`
   and pass any payload through the emitted event.
4. **UI** — add a mode to `src/components/ApprovalPanel.tsx` that renders the editable
   payload and the action button(s).
5. **Plan** — add a branch to `nextStepPlan()` in `src/lib/plan.ts` for the new stage.

## Add a new LLM step
Follow the **build / gate / run** split:
- a `buildXxxPrompt(...)` returning `{ system, lockedSuffix, user }`,
- a `parseXxx(text)` for the result,
  both in a file under `src/lib/agent/`. Keep the JSON-shape instruction in
  `lockedSuffix` (shown locked in the editor). The workflow gates the prompt, then
  calls `runPrompt()` and your parser. Give it a generous `maxTokens` (see
  [DECISIONS.md](DECISIONS.md)).

## Swap a provider (no code change where possible)
Prefer **credential/env-driven** selection so upgrades are config, not code:
- **Reddit official API:** set `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` and the
  registry auto-switches off Apify. (Requires Reddit approval — see
  [reddit-api-application.md](reddit-api-application.md).)
- **Different Apify actors:** override `*_APIFY_ACTOR` / `APIFY_X_ACTOR` env vars.
- **Different model:** `ANTHROPIC_MODEL`.

## Add the future "auto-run" mode
The manual-only flow is deliberate. To add auto-run: thread a per-run flag (a
`runs.config` field is reserved) and, when set, have the workflow auto-decide the
gates instead of waiting (or use a short default `waitForEvent` timeout that
proceeds). Keep the gates as the source of truth so the operator can still drop into
manual control. Don't remove the gate machinery.

## Deploy
See [deploy.md](deploy.md). Key constraints: each Inngest step must fit the host's
function timeout (fetch is already split per-source); Inngest Cloud drives the
workflow in production; Supabase/Resend/Apify all work from a serverless host.
