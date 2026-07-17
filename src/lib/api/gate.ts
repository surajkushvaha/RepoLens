import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { rateLimited } from "@/lib/ratelimit";
import { checkQuota } from "@/lib/usage";
import { checkEmail } from "@/lib/api/email-guard";

// One place that decides whether an API request may proceed. Every route calls
// requireUser (auth + IP rate limit) or requireCredit (that plus the daily AI
// quota). Returning a discriminated union keeps the call sites a single line.

type Ok = { ok: true; userId: string };
type Fail = { ok: false; response: NextResponse };

const fail = (error: string, status: number): Fail => ({
  ok: false,
  response: NextResponse.json({ error }, { status }),
});

// Signed-in required + coarse per-IP rate limit + real-email guard. Use for
// non-AI routes. The email guard keeps throwaway/unverified accounts out of
// every feature (result is cached per user, so it's cheap after the first call).
export async function requireUser(req: Request): Promise<Ok | Fail> {
  if (rateLimited(req)) return fail("Too many requests — slow down", 429);
  const { userId } = await auth();
  if (!userId) return fail("Sign in to continue", 401);
  const email = await checkEmail(userId);
  if (!email.ok) return fail(email.reason, 403);
  return { ok: true, userId };
}

// requireUser + daily credit quota. Use for billable AI routes.
export async function requireCredit(req: Request): Promise<Ok | Fail> {
  const base = await requireUser(req);
  if (!base.ok) return base;
  const q = await checkQuota(base.userId);
  if (!q.allowed)
    return fail(
      `Daily limit reached — ${q.limit} AI actions/day on the ${q.plan} plan. Upgrade to Pro for more.`,
      429,
    );
  return base;
}
