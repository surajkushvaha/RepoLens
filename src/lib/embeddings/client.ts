// Main-thread orchestrator for client-side semantic search.
//
//   files ──chunk──▶ worker(embed) ──▶ Float32 vectors ──▶ IndexedDB
//   query ──worker(embed)──▶ cosine vs stored vectors ──▶ ranked chunks
//
// Nothing here touches the network except the one-time model download inside the
// worker. Embeddings, storage, and search all live in the browser.
import {
  loadRepoChunks,
  saveRepoIndex,
  getRepoMeta,
  touchRepo,
  repoKeyOf,
  type ChunkMeta,
} from "./store";

const CHUNK_LINES = 40;
const OVERLAP = 10;
const MAX_CHUNK_CHARS = 2000;
const MAX_CHUNKS = 6000; // in-browser brute-force stays fast under ~10k
const BATCH = 64;

export type SemanticHit = ChunkMeta & { score: number };
export type BuildProgress =
  | { phase: "model"; loaded?: number; total?: number; file?: string }
  | { phase: "embed"; done: number; total: number }
  | { phase: "save" }
  | { phase: "done"; chunks: number; truncated: boolean };

// ---- chunking --------------------------------------------------------------

// Slice each file into overlapping line-windows, tracking 1-indexed line ranges
// so a hit can jump straight to the right spot in the source.
function chunkFiles(files: Record<string, string>): { chunks: ChunkMeta[]; truncated: boolean } {
  const chunks: ChunkMeta[] = [];
  let truncated = false;
  const paths = Object.keys(files).sort();
  for (const path of paths) {
    const lines = files[path].split("\n");
    for (let start = 0; start < lines.length; start += CHUNK_LINES - OVERLAP) {
      const slice = lines.slice(start, start + CHUNK_LINES);
      const text = slice.join("\n").slice(0, MAX_CHUNK_CHARS);
      if (text.trim().length < 3) continue; // skip blank windows
      chunks.push({
        path,
        startLine: start + 1,
        endLine: Math.min(start + slice.length, lines.length),
        text,
      });
      if (chunks.length >= MAX_CHUNKS) {
        truncated = true;
        return { chunks, truncated };
      }
      if (start + CHUNK_LINES >= lines.length) break;
    }
  }
  return { chunks, truncated };
}

// Prepend the path so file/dir names contribute to the embedding — helps queries
// that name a file or feature area, not just the code inside it.
const embedText = (c: ChunkMeta) => `${c.path}\n${c.text}`;

// ---- worker RPC ------------------------------------------------------------

type Pending = {
  resolve: (v: { buffers: ArrayBuffer[]; dim: number }) => void;
  reject: (e: Error) => void;
};

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
const pending = new Map<number, Pending>();
let seq = 0;
let statusCb: ((p: BuildProgress) => void) | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === "embedded") {
      pending.get(m.id)?.resolve({ buffers: m.buffers, dim: m.dim });
      pending.delete(m.id);
    } else if (m.type === "error") {
      if (typeof m.id === "number") {
        pending.get(m.id)?.reject(new Error(m.message));
        pending.delete(m.id);
      }
    } else if (m.type === "status" && statusCb) {
      const p = m.payload ?? {};
      if (p.status === "progress")
        statusCb({ phase: "model", loaded: p.loaded, total: p.total, file: p.file });
    }
  };
  return worker;
}

// Warm the model. Safe to call repeatedly — resolves once loaded.
export function ensureModel(onProgress?: (p: BuildProgress) => void): Promise<void> {
  if (onProgress) statusCb = onProgress;
  if (ready) return ready;
  const w = getWorker();
  ready = new Promise<void>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data.type === "ready") {
        w.removeEventListener("message", onMsg);
        resolve();
      } else if (e.data.type === "error" && typeof e.data.id !== "number") {
        w.removeEventListener("message", onMsg);
        reject(new Error(e.data.message));
      }
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ type: "load" });
  });
  return ready;
}

function embedBatch(texts: string[]): Promise<{ buffers: ArrayBuffer[]; dim: number }> {
  const w = getWorker();
  const id = seq++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: "embed", id, texts });
  });
}

// ---- public API ------------------------------------------------------------

export async function hasIndex(owner: string, repo: string): Promise<boolean> {
  const meta = await getRepoMeta(repoKeyOf(owner, repo));
  if (meta) await touchRepo(meta.repoKey);
  return !!meta;
}

// Build (or rebuild) the embedding index for a repo and persist it to IndexedDB.
export async function buildIndex(
  owner: string,
  repo: string,
  files: Record<string, string>,
  onProgress?: (p: BuildProgress) => void,
): Promise<void> {
  statusCb = onProgress ?? null;
  const repoKey = repoKeyOf(owner, repo);
  const { chunks, truncated } = chunkFiles(files);

  await ensureModel(onProgress);

  const vectors: Float32Array[] = [];
  let dim = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH).map(embedText);
    const { buffers, dim: d } = await embedBatch(batch);
    dim = d;
    for (const b of buffers) vectors.push(new Float32Array(b));
    onProgress?.({ phase: "embed", done: Math.min(i + BATCH, chunks.length), total: chunks.length });
  }

  onProgress?.({ phase: "save" });
  await saveRepoIndex(repoKey, "Xenova/all-MiniLM-L6-v2", dim, chunks, vectors, truncated);
  onProgress?.({ phase: "done", chunks: chunks.length, truncated });
}

// Semantic search: embed the query, cosine-rank stored chunks (vectors are
// normalized, so dot product == cosine), return the top-k.
export async function search(
  owner: string,
  repo: string,
  query: string,
  k = 12,
): Promise<SemanticHit[]> {
  const repoKey = repoKeyOf(owner, repo);
  await ensureModel();
  const { buffers } = await embedBatch([query]);
  const q = new Float32Array(buffers[0]);

  const rows = await loadRepoChunks(repoKey);
  const scored = rows.map(({ meta, vector }) => {
    let dot = 0;
    for (let i = 0; i < q.length; i++) dot += q[i] * vector[i];
    return { ...meta, score: dot };
  });
  scored.sort((a, b) => b.score - a.score);

  // keep the best chunk per file so results span the codebase, not one hot file
  const seen = new Set<string>();
  const out: SemanticHit[] = [];
  for (const hit of scored) {
    if (seen.has(hit.path)) continue;
    seen.add(hit.path);
    out.push(hit);
    if (out.length >= k) break;
  }
  return out;
}
