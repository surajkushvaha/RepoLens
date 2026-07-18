import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { getRepoCached } from "@/lib/repo/cache";

export const runtime = "nodejs";
export const maxDuration = 45;

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

// Total text we'll hand to the browser for client-side embedding. Generous, but
// bounded so a giant monorepo can't blow up the response.
const MAX_TOTAL_BYTES = 12 * 1024 * 1024; // 12MB of source text
const MAX_FILE_BYTES = 120_000;

// Hands the repo's text files to the client so it can build its own embedding
// index in-browser. No AI key involved — this is plain file delivery.
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo } = parsed.data;

  try {
    const repoFiles = await getRepoCached(owner, repo);
    const files: Record<string, string> = {};
    let total = 0;
    let truncated = repoFiles.truncated;
    for (const [path, content] of repoFiles.files) {
      if (content.length > MAX_FILE_BYTES) {
        truncated = true;
        continue;
      }
      if (total + content.length > MAX_TOTAL_BYTES) {
        truncated = true;
        break;
      }
      files[path] = content;
      total += content.length;
    }
    return NextResponse.json({ owner, repo, files, truncated, commit: repoFiles.commit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load source";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
