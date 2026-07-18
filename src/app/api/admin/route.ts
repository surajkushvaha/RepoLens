import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { isAdmin, lookupClerkUsers } from "@/lib/admin";
import { adminOverview, setBonusCredits, setPlan, type AdminOverview } from "@/lib/usage";
import { evalSummary } from "@/lib/evals";

export const runtime = "nodejs";

// Admin-only. GET returns the platform overview; POST updates a user's plan
// and/or bonus credits. Every request is gated by isAdmin() (verified email on
// the ADMIN_EMAILS allowlist) — a non-admin gets a flat 404 so the endpoint's
// existence isn't advertised.
async function guard(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return null;
}

// Attach each user's email + display name (from Clerk) to the DB overview.
async function withIdentities(ov: AdminOverview): Promise<AdminOverview> {
  const info = await lookupClerkUsers(ov.users.map((u) => u.userId));
  return {
    ...ov,
    users: ov.users.map((u) => ({ ...u, ...(info.get(u.userId) ?? {}) })),
  };
}

export async function GET() {
  const blocked = await guard();
  if (blocked) return blocked;
  const [overview, evals] = await Promise.all([
    withIdentities(await adminOverview()),
    evalSummary(),
  ]);
  return NextResponse.json({ ...overview, evals });
}

const Body = z.object({
  userId: z.string().min(1).max(200),
  plan: z.enum(["free", "pro"]).optional(),
  bonusCredits: z.number().int().min(0).max(100000).optional(),
});

export async function POST(req: Request) {
  const blocked = await guard();
  if (blocked) return blocked;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { userId, plan, bonusCredits } = parsed.data;
  if (plan === undefined && bonusCredits === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  try {
    if (plan !== undefined)
      await setPlan(userId, plan, { plan_source: plan === "pro" ? "admin" : null });
    if (bonusCredits !== undefined) await setBonusCredits(userId, bonusCredits);
    return NextResponse.json(await withIdentities(await adminOverview()));
  } catch (err) {
    console.error("[admin] update failed", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
