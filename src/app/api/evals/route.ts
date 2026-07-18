import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/gate";
import { evaluateAnswer, recordEval } from "@/lib/evals";

export const runtime = "nodejs";

const Body = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  question: z.string().min(1).max(1000),
  answer: z.string().max(20000),
  files: z.array(z.string().max(400)).max(40).optional(),
});

// Record a quality evaluation of a Q&A answer (called by the client once the
// answer finishes streaming). Auth-gated, credit-free, best-effort.
export async function POST(req: Request) {
  const gate = await requireUser(req);
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { owner, repo, question, answer, files } = parsed.data;
  const result = evaluateAnswer(question, answer, files ?? []);
  await recordEval(gate.userId, owner, repo, question, result);
  return NextResponse.json({ ok: true, score: result.score });
}
