import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { getChatThreadMessages, deleteChatThread } from "@/lib/chat";

export const runtime = "nodejs";

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  // which conversation to load/delete; null = the legacy pre-threads bucket
  threadId: z.string().uuid().nullish(),
});

// Load one conversation's messages (to resume it).
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo, threadId } = parsed.data;
  const messages = await getChatThreadMessages(gate.userId, owner, repo, threadId ?? null);
  return NextResponse.json({ messages });
}

// Delete one conversation.
export async function DELETE(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo, threadId } = parsed.data;
  await deleteChatThread(gate.userId, owner, repo, threadId ?? null);
  return NextResponse.json({ ok: true });
}
