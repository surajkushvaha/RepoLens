import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { getRepoCached } from "@/lib/repo/cache";
import { buildKnowledge } from "@/lib/repo/symbols";

export const runtime = "nodejs";
export const maxDuration = 90;

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

// The knowledge graph is built by regex symbol extraction + the dependency
// graph — no LLM call — so, like literal search and source delivery, it's
// auth-gated but free (requireUser, not requireCredit / no credit recorded).
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo } = parsed.data;
  try {
    const repoFiles = await getRepoCached(owner, repo);
    const knowledge = buildKnowledge(repoFiles);
    return NextResponse.json(knowledge);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Knowledge graph failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
