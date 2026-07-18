-- Cache of AI outputs keyed by (feature + repo + commit + input). Same question
-- on the same repo/commit returns the stored answer instantly — no LLM call, no
-- credit. Invalidates naturally because the commit is part of the key. RLS on,
-- service_role only. Idempotent / non-destructive.
create table if not exists public.ai_cache (
  cache_key text primary key,          -- sha256 of feature|repo_key|commit|input
  feature text not null,               -- ask | architecture | readme | summarize
  repo_key text,
  response text not null,              -- the cached output (JSON for ask)
  hits integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ai_cache enable row level security;
create index if not exists ai_cache_repo on public.ai_cache (repo_key);
