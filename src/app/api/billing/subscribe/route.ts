import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createSubscription,
  razorpayConfigured,
  razorpayKeyId,
} from "@/lib/billing/razorpay";

export const runtime = "nodejs";

// Start a Pro subscription for the signed-in user. Returns the subscription id
// and the public key id for Checkout. The Clerk user id rides in the
// subscription `notes` so the webhook can attribute the payment.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }
  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't set up yet — check back soon." },
      { status: 503 },
    );
  }
  try {
    const sub = await createSubscription({ userId });
    return NextResponse.json({ subscriptionId: sub.id, keyId: razorpayKeyId() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 502 },
    );
  }
}
