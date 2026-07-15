import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import tar from "tar-stream";

export type RepoFiles = {
  owner: string;
  repo: string;
  files: Map<string, string>; // repo-relative path -> source text
  truncated: boolean; // hit a cap; graph is partial
};

// ponytail: caps keep us inside serverless time/memory. Bump when we move
// heavy ingestion off the request path (queue + storage).
const MAX_FILES = 2000;
const MAX_FILE_BYTES = 200_000;
const SOURCE_EXT =
  /\.(mts|cts|tsx?|jsx?|mjs|cjs|py|pyi|rb|go|rs|java|kt|kts|scala|swift|php|cs|c|h|cc|cpp|cxx|hpp|hh|m|mm|dart|ex|exs|erl|hs|clj|cljs|cljc|lua|jl|vue|svelte|astro|pl|pm|r)$/i;
const SKIP_DIR =
  /(^|\/)(node_modules|\.next|\.git|dist|build|out|coverage|vendor|__tests__|__pycache__|\.venv|venv|target|Pods|_build|\.gradle|\.tox|\.idea)(\/|$)/;

export function parseRepoUrl(url: string): { owner: string; repo: string } {
  const m = url.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) throw new Error("Not a GitHub repo URL");
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

export async function fetchRepoFiles(url: string): Promise<RepoFiles> {
  const { owner, repo } = parseRepoUrl(url);
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/tarball`,
    {
      headers: {
        "User-Agent": "RepoLens",
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      redirect: "follow",
    },
  );
  if (!res.ok || !res.body) {
    if (res.status === 404) throw new Error("Repo not found or private");
    if (res.status === 403) throw new Error("GitHub rate limit — set GITHUB_TOKEN");
    throw new Error(`GitHub error ${res.status}`);
  }

  const files = new Map<string, string>();
  let truncated = false;
  const extract = tar.extract();

  extract.on("entry", (header, stream, next) => {
    const rel = header.name.replace(/^[^/]+\//, ""); // strip "owner-repo-sha/"
    const skip =
      header.type !== "file" ||
      files.size >= MAX_FILES ||
      header.size! > MAX_FILE_BYTES ||
      !SOURCE_EXT.test(rel) ||
      SKIP_DIR.test(rel);
    if (skip) {
      if (files.size >= MAX_FILES) truncated = true;
      stream.resume();
      stream.on("end", next);
      return;
    }
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      files.set(rel, Buffer.concat(chunks).toString("utf8"));
      next();
    });
    stream.on("error", next);
  });

  await new Promise<void>((resolve, reject) => {
    extract.on("finish", resolve);
    extract.on("error", reject);
    Readable.fromWeb(res.body as import("stream/web").ReadableStream)
      .pipe(createGunzip())
      .on("error", reject)
      .pipe(extract);
  });

  if (files.size === 0)
    throw new Error(
      "No JavaScript/TypeScript files found — RepoLens currently supports JS/TS repos",
    );
  return { owner, repo, files, truncated };
}
