-- Multi-turn "Chat" conversations (distinct from the stateless "Ask" bar).
-- Each turn is stored as a user row + an assistant row, so a returning user
-- resumes the same conversation for that repo. RLS on, service_role only.
-- Idempotent / non-destructive.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  owner text not null,
  repo text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create index if not exists chat_messages_thread
  on public.chat_messages (user_id, owner, repo, created_at);
