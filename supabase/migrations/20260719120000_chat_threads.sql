-- Multiple conversations per repo (ChatGPT-style history list). Each message
-- gets a thread_id so a user can keep several distinct conversations about the
-- same repo, browse them, resume any, and start a new one without wiping the
-- old. Existing rows have thread_id = null and surface as one "earlier
-- conversation". Idempotent / non-destructive.
alter table public.chat_messages
  add column if not exists thread_id uuid;
create index if not exists chat_messages_thread
  on public.chat_messages (user_id, owner, repo, thread_id, created_at);
