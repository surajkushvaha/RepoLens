import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { setPlan } from "@/lib/usage";

export const runtime = "nodejs";

// Razorpay webhook — the durable source of truth for subscription state. It's a
// public endpoint, but every delivery is authenticated by an HMAC signature over
// the raw body: an unsigned or mis-signed request is rejected before we touch
// any account. This is what stops a forged "user X is now Pro" request.
type SubEntity = { id: string; notes?: { userId?: string } };
type Event = { event: string; payload?: { subscription?: { entity?: SubEntity } } };

export async function POST(req: Request) {
  const raw = await req.text(); // raw body required for signature verification
  const sig = req.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: Event;
  try {
    event = JSON.parse(raw) as Event;
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const sub = event.payload?.subscription?.entity;
  const userId = sub?.notes?.userId;
  if (userId && sub) {
    switch (event.event) {
      case "subscription.activated":
      case "subscription.charged":
      case "subscription.resumed":
        await setPlan(userId, "pro", { razorpay_subscription_id: sub.id });
        break;
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.halted":
      case "subscription.paused":
        await setPlan(userId, "free");
        break;
    }
  }
  return NextResponse.json({ received: true });
}
