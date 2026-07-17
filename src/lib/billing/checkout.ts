// Client-side Pro checkout. Creates a subscription server-side, opens Razorpay
// Checkout, and hands the result back to the server for signature verification.
// The browser never decides the plan — it only relays Razorpay's signed result.

type RazorpayResult = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: unknown) => { open: () => void };
  }
}

export async function startProCheckout(): Promise<void> {
  const res = await fetch("/api/billing/subscribe", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not start checkout");

  await loadScript("https://checkout.razorpay.com/v1/checkout.js");
  if (!window.Razorpay) throw new Error("Razorpay failed to load");

  const rzp = new window.Razorpay({
    key: data.keyId,
    subscription_id: data.subscriptionId,
    name: "RepoLens Pro",
    description: "Monthly — unlimited AI, private repos",
    theme: { color: "#6d28d9" },
    handler: async (result: RazorpayResult) => {
      const v = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (v.ok) window.location.href = "/dashboard";
      else alert("Payment verification failed. If you were charged, contact support.");
    },
  });
  rzp.open();
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}
