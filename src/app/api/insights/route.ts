import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { getRepoCached } from "@/lib/repo/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

const extOf = (path: string) => {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return base.toLowerCase(); // dotfile or no ext -> use the name
  return base.slice(dot + 1).toLowerCase();
};

// Repo insight data for the visualizations panel: file-type breakdown (from the
// ingested files) plus top authors and commit activity (from the GitHub commits
// API). All read-only, auth-gated, and credit-free.
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo } = parsed.data;

  try {
    // ---- file-type breakdown from the ingested source ----
    const repoFiles = await getRepoCached(owner, repo);
    const typeMap = new Map<string, { count: number; bytes: number }>();
    for (const [path, content] of repoFiles.files) {
      const ext = extOf(path);
      const t = typeMap.get(ext) ?? { count: 0, bytes: 0 };
      t.count += 1;
      t.bytes += content.length;
      typeMap.set(ext, t);
    }
    const fileTypes = [...typeMap.entries()]
      .map(([ext, v]) => ({ ext, count: v.count, bytes: v.bytes }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const totalFiles = repoFiles.files.size;

    // ---- commits: top authors + activity over time ----
    const authors: { name: string; count: number }[] = [];
    const activity: { date: string; count: number }[] = [];
    let totalCommits = 0;
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
        {
          headers: {
            "User-Agent": "RepoLens",
            Accept: "application/vnd.github+json",
            ...(process.env.GITHUB_TOKEN
              ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
              : {}),
          },
        },
      );
      if (res.ok) {
        const commits = (await res.json()) as Array<{
          commit?: { author?: { name?: string; date?: string } };
          author?: { login?: string } | null;
        }>;
        totalCommits = commits.length;
        const authMap = new Map<string, number>();
        const dayMap = new Map<string, number>();
        for (const c of commits) {
          const name = c.author?.login ?? c.commit?.author?.name ?? "unknown";
          authMap.set(name, (authMap.get(name) ?? 0) + 1);
          const date = (c.commit?.author?.date ?? "").slice(0, 10);
          if (date) dayMap.set(date, (dayMap.get(date) ?? 0) + 1);
        }
        authors.push(
          ...[...authMap.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
        );
        activity.push(
          ...[...dayMap.entries()]
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        );
      }
    } catch {
      /* commits are best-effort — file types still render */
    }

    return NextResponse.json({
      fileTypes,
      totalFiles,
      authors,
      activity,
      totalCommits,
      commitsCapped: totalCommits >= 100,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insights failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
