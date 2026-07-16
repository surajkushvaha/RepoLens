import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimited } from "@/lib/ratelimit";
import { getRepoCached } from "@/lib/repo/cache";
import { buildKnowledge } from "@/lib/repo/symbols";

export const runtime = "nodejs";
export const maxDuration = 45;

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo } = parsed.data;
  try {
    const repoFiles = await getRepoCached(owner, repo);
    return NextResponse.json(buildKnowledge(repoFiles));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Knowledge graph failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
