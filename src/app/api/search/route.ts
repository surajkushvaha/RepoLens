import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimited } from "@/lib/ratelimit";
import { getRepoCached } from "@/lib/repo/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  query: z.string().min(1).max(200),
});

const MAX_FILES = 60;
const MAX_LINES_PER_FILE = 200;

// Literal code search / find-usages: which files contain the query, and where.
export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo, query } = parsed.data;
  const needle = query.trim().toLowerCase();

  try {
    const repoFiles = await getRepoCached(owner, repo);
    const results: { path: string; lines: number[]; count: number }[] = [];
    for (const [path, content] of repoFiles.files) {
      const lines: number[] = [];
      content.split("\n").forEach((line, i) => {
        if (lines.length < MAX_LINES_PER_FILE && line.toLowerCase().includes(needle))
          lines.push(i + 1);
      });
      if (lines.length) results.push({ path, lines, count: lines.length });
    }
    results.sort((a, b) => b.count - a.count);
    return NextResponse.json({ query, results: results.slice(0, MAX_FILES) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
