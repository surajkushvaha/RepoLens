import { supabaseAdmin } from "@/utils/supabase/server";

// Multi-turn "Chat" conversations — distinct from the stateless "Ask" bar.
// A user can have several conversations ("threads") about the same repo. Each
// message row carries a thread_id so threads can be listed, resumed, and
// deleted independently. Legacy rows (thread_id = null) group into one
// "earlier conversation". Fails open (empty history, silent save-skip) when
// Supabase isn't configured.

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatThread = {
  threadId: string | null;
  title: string;
  updatedAt: string;
  count: number;
};

// Messages of one conversation. threadId null = the legacy/pre-threads bucket.
export async function getChatThreadMessages(
  userId: string,
  owner: string,
  repo: string,
  threadId: string | null,
  limit = 60,
): Promise<ChatTurn[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    let q = db
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .eq("owner", owner)
      .eq("repo", repo);
    q = threadId ? q.eq("thread_id", threadId) : q.is("thread_id", null);
    const { data } = await q.order("created_at", { ascending: true }).limit(limit);
    return (data as ChatTurn[]) ?? [];
  } catch {
    return [];
  }
}

// All conversations for a repo, newest first, each with a title (its first user
// message) for the history list.
export async function listChatThreads(
  userId: string,
  owner: string,
  repo: string,
): Promise<ChatThread[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from("chat_messages")
      .select("thread_id, role, content, created_at")
      .eq("user_id", userId)
      .eq("owner", owner)
      .eq("repo", repo)
      .order("created_at", { ascending: true })
      .limit(2000);
    const rows = (data as { thread_id: string | null; role: string; content: string; created_at: string }[]) ?? [];
    const byThread = new Map<string, ChatThread>();
    for (const r of rows) {
      const key = r.thread_id ?? "__legacy__";
      let t = byThread.get(key);
      if (!t) {
        t = { threadId: r.thread_id ?? null, title: "", updatedAt: r.created_at, count: 0 };
        byThread.set(key, t);
      }
      if (!t.title && r.role === "user") t.title = r.content.slice(0, 90);
      t.updatedAt = r.created_at;
      t.count += 1;
    }
    return [...byThread.values()]
      .map((t) => ({ ...t, title: t.title || "Conversation" }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function saveChatMessage(
  userId: string,
  owner: string,
  repo: string,
  role: "user" | "assistant",
  content: string,
  threadId?: string | null,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  try {
    await db
      .from("chat_messages")
      .insert({ user_id: userId, owner, repo, role, content, thread_id: threadId ?? null });
  } catch (err) {
    console.error("[chat] save failed", err);
  }
}

// Delete one conversation (threadId null = the legacy bucket).
export async function deleteChatThread(
  userId: string,
  owner: string,
  repo: string,
  threadId: string | null,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  try {
    let q = db.from("chat_messages").delete().eq("user_id", userId).eq("owner", owner).eq("repo", repo);
    q = threadId ? q.eq("thread_id", threadId) : q.is("thread_id", null);
    await q;
  } catch (err) {
    console.error("[chat] delete failed", err);
  }
}
