import { supabaseAdmin } from "@/utils/supabase/server";

// Per-user analysis history, backed by Supabase (Postgres). All access is
// server-side via the service-role client and scoped by the Clerk user id.
// Everything here is best-effort: if Supabase isn't configured, calls no-op and
// the app behaves exactly as before.

export type RecentRepo = {
  owner: string;
  repo: string;
  repo_url: string;
  last_opened_at: string;
  open_count: number;
};

// Record (or bump) a repo in the user's history. Never throws.
export async function recordAnalysis(
  userId: string,
  owner: string,
  repo: string,
  repoUrl: string,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  try {
    const { data } = await db
      .from("analyses")
      .select("id, open_count")
      .eq("user_id", userId)
      .eq("owner", owner)
      .eq("repo", repo)
      .maybeSingle();

    if (data) {
      await db
        .from("analyses")
        .update({
          last_opened_at: new Date().toISOString(),
          open_count: (data.open_count ?? 0) + 1,
        })
        .eq("id", data.id);
    } else {
      await db
        .from("analyses")
        .insert({ user_id: userId, owner, repo, repo_url: repoUrl });
    }
  } catch (err) {
    console.error("[history] record failed", err);
  }
}

// Most-recently-opened repos for a user. Returns [] on any error / no config.
export async function recentAnalyses(
  userId: string,
  limit = 12,
): Promise<RecentRepo[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from("analyses")
      .select("owner, repo, repo_url, last_opened_at, open_count")
      .eq("user_id", userId)
      .order("last_opened_at", { ascending: false })
      .limit(limit);
    return (data as RecentRepo[]) ?? [];
  } catch (err) {
    console.error("[history] list failed", err);
    return [];
  }
}
