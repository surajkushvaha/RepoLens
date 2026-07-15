import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimited } from "@/lib/ratelimit";
import { aiEnabled, complete } from "@/lib/ai/orchestrator";
import { getRepo } from "@/lib/repo/cache";
import { fetchRepoFiles } from "@/lib/repo/fetch";
import { buildGraph, graphDigest } from "@/lib/repo/graph";

export const runtime = "nodejs";
export const maxDuration = 45;

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

const SYSTEM =
  "You are a staff engineer giving a new teammate a 20-second orientation to a " +
  "codebase. From the structural digest, explain in 4-6 sentences: what kind of " +
  "project this is, the main modules/layers and their roles, the likely entry " +
  "points, and the core tech stack. Confident but grounded in the digest — no " +
  "markdown headings, no bullet lists, plain prose.";

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "No AI provider configured — set a provider key in .env.local" },
      { status: 503 },
    );
  }
  const { owner, repo } = parsed.data;
  try {
    const repoFiles =
      getRepo(owner, repo) ??
      (await fetchRepoFiles(`https://github.com/${owner}/${repo}`));
    const graph = buildGraph(repoFiles);
    const overview = await complete(SYSTEM, graphDigest(graph));
    return NextResponse.json({ overview, externalTop: graph.externalTop });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Overview failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
