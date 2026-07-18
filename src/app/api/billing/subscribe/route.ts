import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createSubscription,
  razorpayConfigured,
  razorpayKeyId,
} from "@/lib/billing/razorpay";
import { linkSubscription } from "@/lib/usage";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Start a Pro subscription for the signed-in user. Returns the subscription id
// and the public key id for Checkout. The Clerk user id rides in the
// subscription `notes` so the webhook can attribute the payment.
//
// Pro checkout is intentionally admin-only for now (public launch pending) —
// only a signed-in admin (ADMIN_EMAILS) can exercise the real flow to test it.
// This is enforced here, not just hidden in the UI, so the API can't be hit
// directly to bypass it.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Pro is coming soon — check back later." },
      { status: 503 },
    );
  }
  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "Pro checkout isn't available right now. Please check back soon." },
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
      { error: "We couldn't start checkout right now. Please try again shortly." },
      { status: 503 },
    );
  }
}
