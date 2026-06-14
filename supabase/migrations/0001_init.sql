-- SignalOS schema
-- Single-user MVP: all access is server-side via the service role key.
-- RLS is left disabled for the slice; add policies before exposing multi-user.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- IDEAS  — a prompt you feed the system
-- ─────────────────────────────────────────────────────────────
create table ideas (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  prompt      text not null,
  status      text not null default 'draft',   -- draft | researching | done | archived
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- RUNS  — one research run for an idea (the workflow instance)
-- ─────────────────────────────────────────────────────────────
create table runs (
  id           uuid primary key default gen_random_uuid(),
  idea_id      uuid not null references ideas(id) on delete cascade,
  status       text not null default 'pending', -- pending | running | awaiting_approval | completed | failed | cancelled
  stage        text not null default 'created', -- created | discovery | tracking | analysis | report | done
  config       jsonb not null default '{}',     -- platforms, tracking window (days), sampling cadence, etc.
  error        text,
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on runs (idea_id);
create index on runs (status);

-- ─────────────────────────────────────────────────────────────
-- SOURCES  — discovered targets the agent proposes; you approve
--   platform: reddit | x | instagram
--   kind:     subreddit | account | search_term | hashtag
-- ─────────────────────────────────────────────────────────────
create table sources (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references runs(id) on delete cascade,
  platform    text not null,
  kind        text not null,
  handle      text not null,            -- e.g. "r/homelab", "@naval", "#cleantok", "best ergonomic mouse"
  url         text,
  rationale   text,                     -- why the agent proposed it
  status      text not null default 'proposed', -- proposed | approved | rejected
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on sources (run_id);
create index on sources (status);

-- ─────────────────────────────────────────────────────────────
-- TRACKED_ITEMS  — individual posts/threads/tweets being tracked
-- ─────────────────────────────────────────────────────────────
create table tracked_items (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references runs(id) on delete cascade,
  source_id     uuid references sources(id) on delete set null,
  platform      text not null,
  external_id   text not null,          -- platform's own id (dedupe key)
  url           text,
  author        text,
  title         text,
  body          text,
  posted_at     timestamptz,
  first_seen_at timestamptz not null default now(),
  metadata      jsonb not null default '{}',
  unique (run_id, platform, external_id)
);
create index on tracked_items (run_id);
create index on tracked_items (source_id);

-- ─────────────────────────────────────────────────────────────
-- METRIC_SAMPLES  — time series. Apify/Reddit give a SNAPSHOT;
--   we re-sample over the window and store each point so we can
--   compute engagement velocity, growth, outliers.
--   Attaches to either a source (account-level) or a tracked_item (post-level).
-- ─────────────────────────────────────────────────────────────
create table metric_samples (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references runs(id) on delete cascade,
  source_id       uuid references sources(id) on delete cascade,
  tracked_item_id uuid references tracked_items(id) on delete cascade,
  scope           text not null,        -- account | post
  captured_at     timestamptz not null default now(),
  -- common normalized metrics (null where N/A); raw kept in `metrics`
  followers       bigint,
  likes           bigint,
  comments        bigint,
  shares          bigint,
  views           bigint,
  score           bigint,               -- reddit upvotes / net score
  metrics         jsonb not null default '{}'
);
create index on metric_samples (run_id);
create index on metric_samples (tracked_item_id, captured_at);
create index on metric_samples (source_id, captured_at);

-- ─────────────────────────────────────────────────────────────
-- APPROVALS  — human-in-the-loop gates. The workflow parks here
--   and resumes when you decide (matched by an Inngest event).
-- ─────────────────────────────────────────────────────────────
create table approvals (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references runs(id) on delete cascade,
  stage        text not null,           -- discovery | tracking
  title        text not null,
  payload      jsonb not null default '{}',  -- what's being approved (e.g. proposed sources)
  status       text not null default 'pending', -- pending | approved | rejected
  decision     jsonb,                   -- your edits / which items approved
  note         text,
  requested_at timestamptz not null default now(),
  decided_at   timestamptz
);
create index on approvals (run_id);
create index on approvals (status);

-- ─────────────────────────────────────────────────────────────
-- LLM_CALLS  — FULL observability. EVERY model call is persisted:
--   discovery, internal reasoning loops, analysis, final report.
--   Nothing the agent outputs is ephemeral.
-- ─────────────────────────────────────────────────────────────
create table llm_calls (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid references runs(id) on delete cascade,
  idea_id        uuid references ideas(id) on delete set null,
  stage          text,                  -- discovery | tracking | analysis | report | misc
  purpose        text,                  -- short label, e.g. "propose_sources", "summarize_thread"
  model          text not null,
  system_prompt  text,
  input          jsonb not null default '[]',  -- the messages array sent
  params         jsonb not null default '{}',  -- temperature, max_tokens, tools, etc.
  output_text    text,                  -- flattened text output
  output_raw     jsonb,                 -- full raw API response (content blocks, tool calls)
  stop_reason    text,
  input_tokens   integer,
  output_tokens  integer,
  cost_usd       numeric(12,6),
  latency_ms     integer,
  status         text not null default 'ok',  -- ok | error
  error          text,
  created_at     timestamptz not null default now()
);
create index on llm_calls (run_id, created_at);
create index on llm_calls (stage);

-- ─────────────────────────────────────────────────────────────
-- ACTIVITY  — human-readable audit of every workflow step, so you
--   have visibility into what the agent did and when ("communicate
--   on every step"). Distinct from llm_calls (raw model I/O).
-- ─────────────────────────────────────────────────────────────
create table activity (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid references runs(id) on delete cascade,
  type        text not null,            -- stage_change | discovery | sample | approval_requested | approval_decided | report | error | info
  message     text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on activity (run_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- REPORTS  — the deliverable
-- ─────────────────────────────────────────────────────────────
create table reports (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references runs(id) on delete cascade,
  idea_id     uuid not null references ideas(id) on delete cascade,
  summary     text,
  body_md     text,                     -- full markdown report
  scorecard   jsonb not null default '{}', -- demand/competition/feasibility scores etc.
  created_at  timestamptz not null default now()
);
create index on reports (run_id);

-- updated_at touch trigger
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger ideas_touch before update on ideas
  for each row execute function touch_updated_at();
create trigger runs_touch before update on runs
  for each row execute function touch_updated_at();
