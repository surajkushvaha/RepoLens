import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { listChatThreads } from "@/lib/chat";

export const runtime = "nodejs";

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

// List this user's past conversations for a repo (newest first) for the Chat
// history rail. Each thread has a title (its first question) and a timestamp.
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo } = parsed.data;
  const threads = await listChatThreads(gate.userId, owner, repo);
  return NextResponse.json({ threads });
}
