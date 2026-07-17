import { NextResponse } from "next/server";
import { GUARDRAIL } from "@/lib/ai/guard";
import { z } from "zod";
import { requireCredit } from "@/lib/api/gate";
import { recordUsage, estimateTokens } from "@/lib/usage";
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
  GUARDRAIL +
  "You are a staff engineer giving a new teammate a 20-second orientation to a " +
  "codebase. From the structural digest, explain in 4-6 sentences: what kind of " +
  "project this is, the main modules/layers and their roles, the likely entry " +
  "points, and the core tech stack. Wrap module names, file names and key " +
  "identifiers in `backticks` and bold the most important ones. Confident but " +
  "grounded in the digest. Concise GitHub-flavored markdown, no big headings.";

export async function POST(req: Request) {
  const gate = await requireCredit(req);
  if (!gate.ok) return gate.response;
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
    const digest = graphDigest(graph);
    const overview = await complete(SYSTEM, digest);
    await recordUsage(gate.userId, "architecture", {
      owner,
      repo,
      tokens: estimateTokens(digest + overview),
    });
    return NextResponse.json({ overview, externalTop: graph.externalTop });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Overview failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
