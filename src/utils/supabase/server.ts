import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client using the SERVICE ROLE key. It bypasses RLS, so it
// must NEVER be imported into client code — service-role is a secret and lives
// only in server env. All per-user history writes/reads go through here, scoped
// by the Clerk user id we pass in our API routes. The `analyses` table has RLS
// enabled with no policies, so nothing but this client can touch it.
//
// Graceful: if the env isn't configured (e.g. a preview without the key), this
// returns null and callers no-op — the app keeps working without history.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceRoleKey) return null;
  cached ??= createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
