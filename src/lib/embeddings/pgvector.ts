import { supabaseAdmin } from "@/utils/supabase/server";

// Server-side store for the shared repo embeddings (pgvector). All access is via
// the service-role client, from Clerk-authenticated API routes. Fails safe when
// Supabase isn't configured — callers then fall back to the browser-only index.

export const repoKeyOf = (owner: string, repo: string) =>
  `${owner}/${repo}`.toLowerCase();

// Dimension of the embedding model (Xenova/all-MiniLM-L6-v2). Must equal the
// pgvector column definition — vector(384) in the migration.
export const EMBED_DIM = 384;

export type IndexMeta = { commit_sha: string; chunks: number } | null;

// Is this repo already indexed, and at which commit?
export async function getIndexMeta(repoKey: string): Promise<IndexMeta> {
  const db = supabaseAdmin();
  if (!db) return null;
  try {
    const { data } = await db
      .from("repo_index_meta")
      .select("commit_sha, chunks")
      .eq("repo_key", repoKey)
      .maybeSingle();
    return (data as IndexMeta) ?? null;
  } catch {
    return null;
  }
}

export type UpChunk = {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  vector: number[];
};

// Insert a batch of chunk rows. `replace` clears the repo's old vectors first
// (used on the first batch of a fresh commit).
export async function insertChunks(
  repoKey: string,
  commitSha: string,
  chunks: UpChunk[],
  replace: boolean,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  if (replace) {
    await db.from("repo_embeddings").delete().eq("repo_key", repoKey);
  }
  if (chunks.length === 0) return;
  const rows = chunks.map((c) => ({
    repo_key: repoKey,
    commit_sha: commitSha,
    path: c.path,
    start_line: c.startLine,
    end_line: c.endLine,
    content: c.content,
    // pgvector accepts the text form "[1,2,3]"
    embedding: JSON.stringify(c.vector),
  }));
  await db.from("repo_embeddings").insert(rows);
}

// Mark the repo as fully indexed at this commit.
export async function setIndexMeta(
  repoKey: string,
  commitSha: string,
  chunks: number,
  model: string,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db.from("repo_index_meta").upsert(
    { repo_key: repoKey, commit_sha: commitSha, chunks, model, updated_at: new Date().toISOString() },
    { onConflict: "repo_key" },
  );
}

export type MatchHit = {
  path: string;
  start_line: number;
  end_line: number;
  content: string;
  score: number;
};

// Cosine-similarity search over one repo's chunks via the SQL RPC.
export async function matchChunks(
  repoKey: string,
  query: number[],
  k: number,
): Promise<MatchHit[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data, error } = await db.rpc("match_repo_chunks", {
      p_repo_key: repoKey,
      p_query: JSON.stringify(query),
      p_match_count: k,
    });
    if (error) {
      console.error("[pgvector] match failed", error);
      return [];
    }
    return (data as MatchHit[]) ?? [];
  } catch (err) {
    console.error("[pgvector] match threw", err);
    return [];
  }
}
