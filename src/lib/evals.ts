import { supabaseAdmin } from "@/utils/supabase/server";

// Answer-quality evaluator. A cheap, LLM-free heuristic that runs after each
// Q&A so we can tell — in aggregate — whether the AI is actually working:
// answering, staying grounded in the retrieved files, and not bailing with
// "I can't determine". Results feed the admin dashboard.

const UNCERTAIN =
  /\b(cannot|can'?t|could ?n'?t|unable to|not able to|do(es)? ?n'?t (have|know|contain|include)|no (files?|excerpts?) (matched|provided|include)|not (enough|include[d]?|contain)|insufficient|no information|can'?t determine|unclear from)\b/i;

export type EvalResult = {
  answered: boolean;
  uncertain: boolean;
  grounded: boolean;
  score: number;
  answerLen: number;
};

const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1).toLowerCase();

// Score an answer 0-100 from three cheap signals.
export function evaluateAnswer(
  question: string,
  answer: string,
  paths: string[],
): EvalResult {
  const text = answer.trim();
  const answerLen = text.length;
  const uncertain = UNCERTAIN.test(text);
  const answered = answerLen >= 40 && !uncertain;

  // grounded = the answer names at least one of the files it was given
  const low = text.toLowerCase();
  const grounded = paths.some((p) => {
    const b = basename(p);
    return b.length > 2 && (low.includes(b) || low.includes(p.toLowerCase()));
  });

  let score = 100;
  if (!answered) score -= 45;
  if (uncertain) score -= 35;
  if (!grounded) score -= 20;
  score = Math.max(0, Math.min(100, score));

  return { answered, uncertain, grounded, score, answerLen };
}

export async function recordEval(
  userId: string,
  owner: string,
  repo: string,
  question: string,
  r: EvalResult,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  try {
    await db.from("answer_evals").insert({
      user_id: userId,
      owner,
      repo,
      question: question.slice(0, 500),
      answered: r.answered,
      uncertain: r.uncertain,
      grounded: r.grounded,
      score: r.score,
      answer_len: r.answerLen,
    });
  } catch (err) {
    console.error("[evals] record failed", err);
  }
}

export type EvalSummary = {
  total: number;
  avgScore: number;
  answeredPct: number;
  groundedPct: number;
  uncertainPct: number;
  recentLow: { owner: string | null; repo: string | null; question: string; score: number; created_at: string }[];
};

// Aggregate for the admin dashboard: recent window + the worst answers to eyeball.
export async function evalSummary(windowN = 500): Promise<EvalSummary> {
  const empty: EvalSummary = {
    total: 0,
    avgScore: 0,
    answeredPct: 0,
    groundedPct: 0,
    uncertainPct: 0,
    recentLow: [],
  };
  const db = supabaseAdmin();
  if (!db) return empty;
  try {
    const { data } = await db
      .from("answer_evals")
      .select("owner, repo, question, answered, grounded, uncertain, score, created_at")
      .order("created_at", { ascending: false })
      .limit(windowN);
    const rows = data ?? [];
    if (rows.length === 0) return empty;
    const n = rows.length;
    const pct = (c: number) => Math.round((c / n) * 100);
    return {
      total: n,
      avgScore: Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / n),
      answeredPct: pct(rows.filter((r) => r.answered).length),
      groundedPct: pct(rows.filter((r) => r.grounded).length),
      uncertainPct: pct(rows.filter((r) => r.uncertain).length),
      recentLow: rows
        .filter((r) => r.score < 55)
        .slice(0, 12)
        .map((r) => ({
          owner: r.owner,
          repo: r.repo,
          question: r.question,
          score: r.score,
          created_at: r.created_at,
        })),
    };
  } catch {
    return empty;
  }
}
