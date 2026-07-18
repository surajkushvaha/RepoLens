import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUsage, getSubscriptionId, listPayments } from "@/lib/usage";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// The signed-in user's billing snapshot: current plan + how they got it, their
// subscription id, their payment history, and whether Pro checkout is
// available to them (admin-only for now — public launch pending). Empty
// payments simply means no active subscription yet.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }
  const [usage, subscriptionId, payments, admin] = await Promise.all([
    getUsage(userId),
    getSubscriptionId(userId),
    listPayments(userId),
    isAdmin(),
  ]);
  return NextResponse.json({
    plan: usage.plan,
    planSource: usage.planSource,
    subscriptionId,
    payments,
    proCheckoutAvailable: admin,
  });
}
