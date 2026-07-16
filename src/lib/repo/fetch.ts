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

// Every text file is fair game — code, config, docs, data. We ingest by
// exclusion instead of an allowlist: skip known-binary extensions, then sniff
// the bytes for a NUL to catch anything the extension missed. This is what lets
// the client-side embedder index (and semantic-search) a repo of any language.
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|avif|bmp|ico|tiff?|svgz|psd|xcf|mp[34]|m4a|aac|ogg|flac|wav|mov|mp4|avi|mkv|webm|woff2?|ttf|otf|eot|zip|gz|tgz|bz2|xz|7z|rar|tar|jar|war|ear|class|pyc|pyo|o|obj|a|so|dylib|dll|exe|bin|wasm|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|db|sqlite3?|dat|node|lock|snap|parquet|avro|onnx|pt|pth|ckpt|safetensors|npy|npz|bin7)$/i;
// Text, but noise for a code map / embeddings — huge, generated, low-signal.
const NOISE =
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lock(b)?|composer\.lock|Cargo\.lock|Gemfile\.lock|poetry\.lock)$|\.(min\.(js|css)|map)$/i;
const SKIP_DIR =
  /(^|\/)(node_modules|\.next|\.git|dist|build|out|coverage|vendor|__tests__|__pycache__|\.venv|venv|target|Pods|_build|\.gradle|\.tox|\.idea)(\/|$)/;

// Cheap binary sniff: a NUL byte in the first slab means it isn't text.
function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

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
      BINARY_EXT.test(rel) ||
      NOISE.test(rel) ||
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
      const buf = Buffer.concat(chunks);
      // sniff bytes: extension-less binaries (images, compiled) still get dropped
      if (!looksBinary(buf)) files.set(rel, buf.toString("utf8"));
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
    throw new Error("No readable text files found in this repository");
  return { owner, repo, files, truncated };
}
