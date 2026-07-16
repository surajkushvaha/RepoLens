import crypto from "node:crypto";

// Razorpay server helper. The KEY SECRET and WEBHOOK SECRET are server-only and
// never leave this module. All trust decisions (did this payment really happen?)
// are made by verifying HMAC signatures here — we never trust the browser's
// word that a payment succeeded. This is the anti-fraud core of billing.

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const PLAN_ID = process.env.RAZORPAY_PLAN_ID;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export const razorpayConfigured = () => !!(KEY_ID && KEY_SECRET && PLAN_ID);
export const razorpayKeyId = () => KEY_ID ?? "";

// Create a subscription against the configured Plan. `notes` carries the Clerk
// user id so the webhook can attribute payments back to the right account.
export async function createSubscription(
  notes: Record<string, string>,
): Promise<{ id: string }> {
  if (!razorpayConfigured()) throw new Error("Billing is not configured yet");
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64"),
    },
    body: JSON.stringify({
      plan_id: PLAN_ID,
      total_count: 12, // 12 monthly cycles; renew/extend as needed
      customer_notify: 1,
      notes,
    }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data?.error?.description ?? "Failed to create subscription");
  return { id: data.id as string };
}

// Verify the signature Razorpay Checkout returns on success. For subscriptions
// the payload is `payment_id|subscription_id`, HMAC-SHA256 with the key secret.
export function verifyCheckoutSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
): boolean {
  if (!KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

// Verify the X-Razorpay-Signature header on webhook deliveries.
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
}

// Constant-time compare to avoid timing side channels on signature checks.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
