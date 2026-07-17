import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { fetchRepoFiles } from "@/lib/repo/fetch";
import { buildGraph } from "@/lib/repo/graph";
import { putRepo } from "@/lib/repo/cache";
import { recordAnalysis } from "@/lib/history";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  repoUrl: z.string().url().refine((u) => u.includes("github.com"), {
    message: "Only public GitHub URLs are supported",
  }),
});

export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  try {
    const repo = await fetchRepoFiles(parsed.data.repoUrl);
    putRepo(repo);
    const graph = buildGraph(repo);

    // best-effort: remember this repo in the signed-in user's history
    await recordAnalysis(gate.userId, repo.owner, repo.repo, parsed.data.repoUrl);

    return NextResponse.json({ owner: repo.owner, repo: repo.repo, ...graph });
  } catch (err) {
    console.error("[analyze]", parsed.data.repoUrl, err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
