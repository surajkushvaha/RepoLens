import { supabaseAdmin } from "@/utils/supabase/server";

// Multi-turn "Chat" conversations — distinct from the stateless "Ask" bar.
// Each turn persists as a user row + an assistant row, scoped per user+repo, so
// a returning visitor resumes the same conversation. Fails open (empty
// history, silent save-skip) when Supabase isn't configured.

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function getChatHistory(
  userId: string,
  owner: string,
  repo: string,
  limit = 40,
): Promise<ChatTurn[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .eq("owner", owner)
      .eq("repo", repo)
      .order("created_at", { ascending: true })
      .limit(limit);
    return (data as ChatTurn[]) ?? [];
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
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  try {
    await db.from("chat_messages").insert({ user_id: userId, owner, repo, role, content });
  } catch (err) {
    console.error("[chat] save failed", err);
  }
}

export async function clearChatHistory(userId: string, owner: string, repo: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  try {
    await db.from("chat_messages").delete().eq("user_id", userId).eq("owner", owner).eq("repo", repo);
  } catch (err) {
    console.error("[chat] clear failed", err);
  }
}
