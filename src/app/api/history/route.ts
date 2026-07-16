import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { recentAnalyses } from "@/lib/history";

export const runtime = "nodejs";

// Recent repos for the signed-in user. Auth is enforced here: no Clerk session,
// no data. History rows are only ever reachable through this authenticated route
// (the table's RLS denies the publishable key entirely).
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ recent: [] }, { status: 200 });
  }
  const recent = await recentAnalyses(userId);
  return NextResponse.json({ recent });
}
