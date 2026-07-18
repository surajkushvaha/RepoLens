import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUsage, recentEvents } from "@/lib/usage";
import { recentAnalyses } from "@/lib/history";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Everything the dashboard (and the landing page's pricing) needs: plan +
// today's credit usage + token spend, recent repos, a recent-activity feed,
// and whether Pro checkout is available to this account. Auth-gated — a user
// only ever sees their own data (queries are scoped by the Clerk user id
// server-side).
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }
  const [usage, repos, events, admin] = await Promise.all([
    getUsage(userId),
    recentAnalyses(userId, 12),
    recentEvents(userId, 20),
    isAdmin(),
  ]);
  // Pro checkout is admin-only for now (public launch pending) — surfaced here
  // so the UI can show "Coming soon" instead of a buy button for everyone else.
  return NextResponse.json({ usage, repos, events, proCheckoutAvailable: admin });
}
