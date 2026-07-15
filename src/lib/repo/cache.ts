import { fetchRepoFiles, type RepoFiles } from "./fetch";

// ponytail: per-process cache of the last few analyzed repos, so Q&A/search
// reuse the files analyze already fetched instead of re-downloading. Won't
// survive serverless cold starts or span instances — callers fall back to a
// re-fetch on miss. Swap for Upstash/Redis when persistence or multi-instance
// matters.
const store = new Map<string, RepoFiles>();
const MAX = 3;

const key = (owner: string, repo: string) => `${owner}/${repo}`.toLowerCase();

export function putRepo(r: RepoFiles): void {
  const k = key(r.owner, r.repo);
  store.delete(k);
  store.set(k, r);
  while (store.size > MAX) store.delete(store.keys().next().value!);
}

export function getRepo(owner: string, repo: string): RepoFiles | null {
  return store.get(key(owner, repo)) ?? null;
}

// Cache-first repo access: reuse the analyzed repo, else re-fetch (and cache).
export async function getRepoCached(
  owner: string,
  repo: string,
): Promise<RepoFiles> {
  const hit = getRepo(owner, repo);
  if (hit) return hit;
  const fresh = await fetchRepoFiles(`https://github.com/${owner}/${repo}`);
  putRepo(fresh);
  return fresh;
}
