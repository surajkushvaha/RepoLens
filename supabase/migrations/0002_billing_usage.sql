-- RUN THIS ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query
-- → paste → Run) for the RepoLens project. Adds plan + usage tracking.
--
-- Like `analyses`, both tables have RLS enabled with NO policies: the anon /
-- publishable key can't touch them. They're reachable only through the
-- server-side service_role key, from our Clerk-authenticated API routes.

-- One row per Clerk user. Tracks their plan and Razorpay linkage.
create table if not exists public.profiles (
  user_id text primary key,                 -- Clerk user id
  plan text not null default 'free' check (plan in ('free', 'pro')),
  razorpay_customer_id text,
  razorpay_subscription_id text,
  plan_updated_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Append-only log of billable/interesting actions. Powers the daily quota and
-- the usage dashboard (credits used, tokens, which repo).
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                     -- Clerk user id
  action text not null,                      -- ask | summarize | architecture | readme | knowledge | analyze
  owner text,
  repo text,
  tokens integer not null default 0,         -- approximate tokens spent
  created_at timestamptz not null default now()
);
alter table public.usage_events enable row level security;

create index if not exists usage_events_user_day
  on public.usage_events (user_id, created_at desc);
