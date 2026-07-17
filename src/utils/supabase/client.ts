import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client using the publishable (anon) key — safe to expose.
// Kept for future client-side reads of public data; per-user history is served
// through Clerk-authenticated API routes (see utils/supabase/server.ts), not
// this client. Returns null when env isn't configured so callers can no-op.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = () =>
  url && key ? createBrowserClient(url, key) : null;
