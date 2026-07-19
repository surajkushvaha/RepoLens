import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { matchChunks, repoKeyOf, EMBED_DIM } from "@/lib/embeddings/pgvector";

export const runtime = "nodejs";

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  query: z.array(z.number()).length(EMBED_DIM), // browser-computed query vector, must match vector(384)
  k: z.number().int().min(1).max(30).optional(),
});

// Semantic search over the shared index: the browser embeds the query, we run
// the pgvector cosine match, and return the best chunks (with their text) so
// they can be shown and fed to Q&A as context.
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo, query, k } = parsed.data;
  const hits = await matchChunks(repoKeyOf(owner, repo), query, k ?? 12);
  return NextResponse.json({
    hits: hits.map((h) => ({
      path: h.path,
      startLine: h.start_line,
      endLine: h.end_line,
      text: h.content,
      score: h.score,
    })),
  });
}
