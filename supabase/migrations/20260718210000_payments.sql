-- Payment records from Razorpay (subscription charges + checkout confirmations).
-- Powers the user's billing history and the admin's refund/cancellation view.
-- RLS on, service_role only. Idempotent / non-destructive.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  payment_id text,          -- Razorpay payment id (transaction id)
  subscription_id text,     -- Razorpay subscription id (reference id)
  amount integer,           -- smallest currency unit (paise)
  currency text default 'INR',
  status text,              -- captured | authorized | failed | ...
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create index if not exists payments_user on public.payments (user_id, created_at desc);
create index if not exists payments_created on public.payments (created_at desc);
