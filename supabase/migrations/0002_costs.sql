-- Cost tracking. Single source of truth for spend across every third party.
--   provider: anthropic | apify | reddit | resend | other
--   category: llm | scrape | email | other
-- LLM costs are also kept on llm_calls.cost_usd (detailed log); this table
-- is the aggregate ledger the /costs dashboard reads.

create table cost_events (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid references runs(id) on delete set null,
  idea_id     uuid references ideas(id) on delete set null,
  provider    text not null,
  category    text not null default 'other',
  description text,
  amount_usd  numeric(12,6) not null default 0,
  units       numeric,                 -- tokens, results, compute units, etc.
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on cost_events (idea_id);
create index on cost_events (run_id);
create index on cost_events (provider);
create index on cost_events (created_at);
