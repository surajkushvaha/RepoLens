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
export const maxDuration = 60;

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

const SYSTEM =
  GUARDRAIL +
  "You are writing an onboarding README.md for a developer new to this repo. " +
  "Output GitHub-flavored Markdown only — no commentary before or after. " +
  "Include, in order: an H1 title, a one-sentence description, an Overview " +
  "paragraph, a Tech Stack list, a Project Structure section describing the " +
  "top-level directories, a Key Modules section naming specific important " +
  "files, and a 'Where to start reading' section pointing to concrete entry " +
  "points. Base everything on the digest. If you must assume something (e.g. " +
  "install/run commands), keep it generic and note it as an assumption. Do not " +
  "invent features the structure doesn't imply.";

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
    const prompt = `Repository: ${owner}/${repo}\n\n${graphDigest(graph)}`;
    const markdown = await complete(SYSTEM, prompt);
    await recordUsage(gate.userId, "readme", {
      owner,
      repo,
      tokens: estimateTokens(prompt + markdown),
    });
    return NextResponse.json({ markdown });
  } catch (err) {
    const message = err instanceof Error ? err.message : "README generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
