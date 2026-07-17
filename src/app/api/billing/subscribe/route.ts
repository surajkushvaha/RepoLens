import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createSubscription,
  razorpayConfigured,
  razorpayKeyId,
} from "@/lib/billing/razorpay";
import { linkSubscription } from "@/lib/usage";

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
    // bind this subscription to the user so verify can't be replayed elsewhere
    await linkSubscription(userId, sub.id);
    return NextResponse.json({ subscriptionId: sub.id, keyId: razorpayKeyId() });
  } catch (err) {
    // Keep the real Razorpay error in server logs (e.g. an invalid plan id) but
    // never leak it to the browser — the user just sees a calm "coming soon".
    console.error("[billing/subscribe]", err);
    return NextResponse.json(
      { error: "Pro checkout is being finalized — please check back soon." },
      { status: 503 },
    );
  }
}
