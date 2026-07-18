import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { verifyCheckoutSignature } from "@/lib/billing/razorpay";
import { setPlan, getSubscriptionId, recordPayment } from "@/lib/usage";

export const runtime = "nodejs";

const Body = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// Confirm a just-completed Checkout. We upgrade the plan ONLY if the signature
// verifies — the browser's claim of success is never trusted on its own. The
// webhook is the durable source of truth; this just makes the UI feel instant.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } =
    parsed.data;

  // the subscription must be one WE created for THIS user (set at checkout start)
  const ownSub = await getSubscriptionId(userId);
  if (ownSub && ownSub !== razorpay_subscription_id) {
    return NextResponse.json(
      { error: "Subscription does not belong to this account" },
      { status: 403 },
    );
  }

  if (
    !verifyCheckoutSignature(
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    )
  ) {
    return NextResponse.json(
      { error: "Signature verification failed" },
      { status: 400 },
    );
  }

  await setPlan(userId, "pro", { razorpay_subscription_id, plan_source: "razorpay" });
  await recordPayment(userId, {
    payment_id: razorpay_payment_id,
    subscription_id: razorpay_subscription_id,
    status: "captured",
  });
  return NextResponse.json({ ok: true });
}
