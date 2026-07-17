-- Already applied to the RepoLens project. Kept here as the source of truth.
-- Per-user analysis history. RLS enabled with NO policies, so the anon /
-- publishable key can read nothing: rows are reachable only via the server-side
-- service_role key, through our Clerk-authenticated API routes.
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,            -- Clerk user id (auth().userId)
  owner text not null,
  repo text not null,
  repo_url text not null,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1,
  unique (user_id, owner, repo)
);

alter table public.analyses enable row level security;

create index if not exists analyses_user_recent
  on public.analyses (user_id, last_opened_at desc);
