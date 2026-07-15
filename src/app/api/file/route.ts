import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimited } from "@/lib/ratelimit";
import { getRepoCached } from "@/lib/repo/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  path: z
    .string()
    .min(1)
    .max(300)
    .refine((p) => !p.split("/").includes(".."), "Invalid path"),
});

const MAX_CHARS = 120_000;

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo, path } = parsed.data;
  try {
    const repoFiles = await getRepoCached(owner, repo);
    const code = repoFiles.files.get(path);
    if (code == null) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({
      code: code.slice(0, MAX_CHARS),
      truncated: code.length > MAX_CHARS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load file";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
