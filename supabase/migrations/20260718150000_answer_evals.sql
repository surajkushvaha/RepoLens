-- Answer-quality evaluations. After each Q&A, a cheap heuristic scores whether
-- the AI actually answered, stayed grounded in the retrieved files, or bailed
-- with "I can't determine" (a signal that retrieval is failing). The admin
-- dashboard aggregates these so you can see, at a glance, if the AI is working.
-- RLS on, no policies: server-side (service_role) access only.
create table if not exists public.answer_evals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  owner text,
  repo text,
  question text not null,
  answered boolean not null default false,   -- produced a real answer
  uncertain boolean not null default false,  -- hedged / refused / "can't determine"
  grounded boolean not null default false,   -- referenced the provided files
  score int not null default 0,              -- 0-100 heuristic quality score
  answer_len int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.answer_evals enable row level security;
create index if not exists answer_evals_created
  on public.answer_evals (created_at desc);
