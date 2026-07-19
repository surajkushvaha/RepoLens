import { fetchRepoFiles, type RepoFiles } from "./fetch";
import { buildGraph, type RepoGraph } from "./graph";

// ponytail: per-process cache of the last few analyzed repos, so Q&A/search
// reuse the files analyze already fetched instead of re-downloading. Won't
// survive serverless cold starts or span instances — callers fall back to a
// re-fetch on miss. Swap for Upstash/Redis when persistence or multi-instance
// matters.
const store = new Map<string, RepoFiles>();
const MAX = 3;

const key = (owner: string, repo: string) => `${owner}/${repo}`.toLowerCase();

// GitHub owner/repo names are restricted to these chars. Validate before we ever
// interpolate them into an api.github.com URL, so a crafted name can't reshape
// the request path (defense-in-depth on top of the routes' zod schemas).
const NAME = /^[A-Za-z0-9_.-]+$/;
function assertNames(owner: string, repo: string): void {
  if (!NAME.test(owner) || !NAME.test(repo)) {
    throw new Error("Invalid repository name");
  }
}

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
  assertNames(owner, repo);
  const hit = getRepo(owner, repo);
  if (hit) return hit;
  const fresh = await fetchRepoFiles(`https://github.com/${owner}/${repo}`);
  putRepo(fresh);
  return fresh;
}

// Memoized dependency graph, keyed by repo + commit — buildGraph is a full
// regex scan, so the Q&A/Chat GraphRAG step reuses it instead of rebuilding
// per request.
const graphStore = new Map<string, RepoGraph>();
export function getGraphCached(repo: RepoFiles): RepoGraph {
  const k = `${repo.owner}/${repo.repo}@${repo.commit}`.toLowerCase();
  const hit = graphStore.get(k);
  if (hit) return hit;
  const g = buildGraph(repo);
  graphStore.delete(k);
  graphStore.set(k, g);
  while (graphStore.size > MAX) graphStore.delete(graphStore.keys().next().value!);
  return g;
}
