import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import {
  insertChunks,
  setIndexMeta,
  repoKeyOf,
  getIndexMeta,
  EMBED_DIM,
} from "@/lib/embeddings/pgvector";

export const runtime = "nodejs";
export const maxDuration = 30;

const Chunk = z.object({
  path: z.string().min(1).max(400),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  content: z.string().min(1).max(4000),
  // must match the pgvector column dimension (vector(384)); a wrong length
  // otherwise passes validation and fails deep in Postgres as a generic error
  vector: z.array(z.number()).length(EMBED_DIM),
});

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  commit: z.string().min(1).max(80),
  model: z.string().max(120).optional(),
  chunks: z.array(Chunk).max(600),
  replace: z.boolean().optional(), // clear old vectors first (first batch)
  done: z.boolean().optional(), // last batch -> write the index meta
  totalChunks: z.number().int().nonnegative().optional(),
});

// Receive a batch of browser-computed embeddings for a repo and persist them so
// other users reuse the index instead of re-embedding. Writing requires auth
// (and passes the disposable-email guard), but costs no AI credit.
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  const { owner, repo, commit, model, chunks, replace, done, totalChunks } = parsed.data;
  const repoKey = repoKeyOf(owner, repo);
  try {
    // Anti-poisoning: don't let anyone wipe an index that's already complete for
    // this exact commit. A fresh commit (or first-ever build) is still allowed.
    if (replace) {
      const meta = await getIndexMeta(repoKey);
      if (meta && meta.commit_sha === commit && meta.chunks > 0) {
        return NextResponse.json({ ok: true, skipped: "already-indexed" });
      }
    }
    await insertChunks(repoKey, commit, chunks, !!replace);
    if (done) {
      await setIndexMeta(repoKey, commit, totalChunks ?? chunks.length, model ?? "unknown");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[embeddings/upsert]", err);
    return NextResponse.json({ error: "Upsert failed" }, { status: 500 });
  }
}
