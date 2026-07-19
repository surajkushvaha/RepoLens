// Client helpers for the SHARED server-side index (Supabase pgvector). The
// browser still does all embedding — it just uploads the vectors so other users
// reuse them, and runs search server-side against the shared store. Everything
// degrades gracefully: any failure here lets the caller fall back to the
// browser-only index.
import { embedQuery, type SemanticHit } from "./client";
import type { ChunkMeta } from "./store";

export async function serverIndexStatus(
  owner: string,
  repo: string,
  commit: string,
): Promise<{ indexed: boolean; chunks: number }> {
  try {
    const res = await fetch("/api/embeddings/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo, commit }),
    });
    if (!res.ok) return { indexed: false, chunks: 0 };
    return await res.json();
  } catch {
    return { indexed: false, chunks: 0 };
  }
}

// Upload the freshly-built index to the shared store, in batches. Best-effort:
// resolves quietly even if a batch fails (the local index still works).
export async function uploadIndex(
  owner: string,
  repo: string,
  commit: string,
  chunks: ChunkMeta[],
  vectors: Float32Array[],
  model: string,
): Promise<void> {
  // Bigger batches = far fewer POSTs, so a 6000-chunk repo uploads in ~12
  // requests instead of ~40 and doesn't trip the per-IP rate limit partway
  // through (which used to leave the shared index half-written and never
  // marked "indexed", so every later visitor re-uploaded and re-failed).
  const BATCH = 500;
  const total = chunks.length;
  for (let i = 0; i < total; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH).map((c, j) => ({
      path: c.path,
      startLine: c.startLine,
      endLine: c.endLine,
      content: c.text,
      vector: Array.from(vectors[i + j]),
    }));
    try {
      const res = await fetch("/api/embeddings/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          commit,
          model,
          chunks: slice,
          replace: i === 0,
          done: i + BATCH >= total,
          totalChunks: total,
        }),
      });
      if (!res.ok) return; // give up quietly; local index still serves
    } catch {
      return;
    }
  }
}

// Search the shared store: embed the query in the browser, send the vector,
// get back ranked chunks (already in SemanticHit shape).
export async function serverSearch(
  owner: string,
  repo: string,
  query: string,
  k = 12,
): Promise<SemanticHit[]> {
  const vec = await embedQuery(query);
  const res = await fetch("/api/embeddings/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner, repo, query: vec, k }),
  });
  if (!res.ok) throw new Error("Shared search failed");
  const data = await res.json();
  return (data.hits ?? []) as SemanticHit[];
}
