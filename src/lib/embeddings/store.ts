// Client-side vector store, backed by IndexedDB. Holds one embedding index per
// repo (chunks + their vectors) so semantic search runs entirely in the browser
// with zero network round-trips after the first index build. Vectors are stored
// as raw Float32 ArrayBuffers (compact, no JSON bloat).
//
// LRU: repos the user hasn't touched get evicted first. Each search/build bumps
// `lastAccessed`; once we exceed MAX_REPOS (or the byte budget) the coldest repo
// index is dropped. This is the "least-used" strategy — a rarely-opened repo's
// data doesn't linger and eat the origin's storage quota.

const DB_NAME = "repolens-vectors";
const DB_VERSION = 1;
const STORE_META = "meta";
const STORE_CHUNKS = "chunks";

// Eviction budget. In-browser brute-force search stays snappy well under these.
const MAX_REPOS = 5;
const MAX_TOTAL_BYTES = 220 * 1024 * 1024; // ~220MB of vectors across all repos

export type ChunkMeta = {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
};

export type RepoMeta = {
  repoKey: string; // "owner/repo" lowercased
  model: string;
  dim: number;
  chunkCount: number;
  bytes: number; // approx vector bytes, for the eviction budget
  createdAt: number;
  lastAccessed: number;
  truncated: boolean;
};

// A chunk row as persisted. `vector` is a normalized Float32 embedding.
type ChunkRow = ChunkMeta & { repoKey: string; vector: ArrayBuffer };

export const repoKeyOf = (owner: string, repo: string) =>
  `${owner}/${repo}`.toLowerCase();

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "repoKey" });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const s = db.createObjectStore(STORE_CHUNKS, { autoIncrement: true });
        s.createIndex("repoKey", "repoKey", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): [IDBObjectStore, IDBObjectStore, Promise<void>] {
  const t = db.transaction([STORE_META, STORE_CHUNKS], mode);
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  return [t.objectStore(STORE_META), t.objectStore(STORE_CHUNKS), done];
}

const asPromise = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function getRepoMeta(repoKey: string): Promise<RepoMeta | null> {
  const db = await openDB();
  const [meta] = tx(db, "readonly");
  return (await asPromise(meta.get(repoKey))) ?? null;
}

export async function listRepoMeta(): Promise<RepoMeta[]> {
  const db = await openDB();
  const [meta] = tx(db, "readonly");
  return (await asPromise(meta.getAll())) as RepoMeta[];
}

// Persist a freshly built index: wipe any prior rows for this repo, write the
// new chunks + meta, then run LRU eviction to stay within budget.
export async function saveRepoIndex(
  repoKey: string,
  model: string,
  dim: number,
  chunks: ChunkMeta[],
  vectors: Float32Array[],
  truncated: boolean,
): Promise<void> {
  const db = await openDB();
  await deleteRepo(repoKey);

  let bytes = 0;
  const [meta, store, done] = tx(db, "readwrite");
  for (let i = 0; i < chunks.length; i++) {
    const buf = vectors[i].buffer.slice(0) as ArrayBuffer;
    bytes += buf.byteLength;
    const row: ChunkRow = { repoKey, ...chunks[i], vector: buf };
    store.add(row);
  }
  const now = Date.now();
  const record: RepoMeta = {
    repoKey,
    model,
    dim,
    chunkCount: chunks.length,
    bytes,
    createdAt: now,
    lastAccessed: now,
    truncated,
  };
  meta.put(record);
  await done;
  await evictIfNeeded(repoKey);
}

// Load every chunk + vector for a repo. Bumps lastAccessed (an access, for LRU).
export async function loadRepoChunks(
  repoKey: string,
): Promise<{ meta: ChunkMeta; vector: Float32Array }[]> {
  const db = await openDB();
  const [meta, store, done] = tx(db, "readwrite");
  const idx = store.index("repoKey");
  const rows = (await asPromise(
    idx.getAll(IDBKeyRange.only(repoKey)),
  )) as ChunkRow[];
  const rec = (await asPromise(meta.get(repoKey))) as RepoMeta | undefined;
  if (rec) {
    rec.lastAccessed = Date.now();
    meta.put(rec);
  }
  await done;
  return rows.map((r) => ({
    meta: { path: r.path, startLine: r.startLine, endLine: r.endLine, text: r.text },
    vector: new Float32Array(r.vector),
  }));
}

export async function touchRepo(repoKey: string): Promise<void> {
  const db = await openDB();
  const [meta, , done] = tx(db, "readwrite");
  const rec = (await asPromise(meta.get(repoKey))) as RepoMeta | undefined;
  if (rec) {
    rec.lastAccessed = Date.now();
    meta.put(rec);
  }
  await done;
}

export async function deleteRepo(repoKey: string): Promise<void> {
  const db = await openDB();
  const [meta, store, done] = tx(db, "readwrite");
  meta.delete(repoKey);
  const idx = store.index("repoKey");
  // cursor-delete every chunk row belonging to this repo
  const cursorReq = idx.openCursor(IDBKeyRange.only(repoKey));
  cursorReq.onsuccess = () => {
    const cur = cursorReq.result;
    if (cur) {
      cur.delete();
      cur.continue();
    }
  };
  await done;
}

// LRU + byte-budget eviction. Never evicts the repo the user is currently on.
async function evictIfNeeded(keep: string): Promise<void> {
  let all = await listRepoMeta();
  const overCount = () => all.length > MAX_REPOS;
  const totalBytes = () => all.reduce((s, r) => s + r.bytes, 0);

  while ((overCount() || totalBytes() > MAX_TOTAL_BYTES) && all.length > 1) {
    const victim = all
      .filter((r) => r.repoKey !== keep)
      .sort((a, b) => a.lastAccessed - b.lastAccessed)[0];
    if (!victim) break;
    await deleteRepo(victim.repoKey);
    all = all.filter((r) => r.repoKey !== victim.repoKey);
  }
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  const [meta, store, done] = tx(db, "readwrite");
  meta.clear();
  store.clear();
  await done;
}
