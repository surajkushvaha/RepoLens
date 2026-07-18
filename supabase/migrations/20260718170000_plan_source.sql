-- How a user got their plan: 'admin' (granted from the admin dashboard),
-- 'razorpay' (self-purchased), or null (default free). Lets the UI show
-- "upgraded to Pro by admin" and keeps billing history honest. Idempotent.
alter table public.profiles
  add column if not exists plan_source text;
