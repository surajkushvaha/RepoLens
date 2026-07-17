import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUsage, recentEvents } from "@/lib/usage";
import { recentAnalyses } from "@/lib/history";

export const runtime = "nodejs";

// Everything the dashboard needs: plan + today's credit usage + token spend,
// recent repos, and a recent-activity feed. Auth-gated — a user only ever sees
// their own data (queries are scoped by the Clerk user id server-side).
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }
  const [usage, repos, events] = await Promise.all([
    getUsage(userId),
    recentAnalyses(userId, 12),
    recentEvents(userId, 20),
  ]);
  return NextResponse.json({ usage, repos, events });
}
