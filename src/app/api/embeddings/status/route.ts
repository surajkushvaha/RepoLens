import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { getIndexMeta, repoKeyOf } from "@/lib/embeddings/pgvector";

export const runtime = "nodejs";

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  commit: z.string().min(1).max(80),
});

// Is this repo already vectorized at the given commit? Lets the client skip
// re-embedding when a shared index already exists.
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo, commit } = parsed.data;
  const meta = await getIndexMeta(repoKeyOf(owner, repo));
  const indexed = !!meta && meta.commit_sha === commit;
  return NextResponse.json({ indexed, chunks: meta?.chunks ?? 0 });
}
