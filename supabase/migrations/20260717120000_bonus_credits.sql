-- Per-user bonus daily credits, granted by an admin from the /admin dashboard.
-- Added on top of the plan's daily limit when the quota is checked. Idempotent
-- so re-runs are safe.
alter table public.profiles
  add column if not exists bonus_credits integer not null default 0;
