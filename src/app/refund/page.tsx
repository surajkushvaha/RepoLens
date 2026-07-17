import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: `Refund and cancellation terms for ${SITE.name} Pro.`,
  alternates: { canonical: "/refund" },
};

export default function Refund() {
  return (
    <LegalPage title="Refund & Cancellation Policy" updated="July 2026">
      <p>
        This policy applies to the paid <strong>{SITE.name} Pro</strong>{" "}
        subscription, billed monthly through Razorpay.
      </p>

      <h2>Cancellation</h2>
      <p>
        You can cancel your Pro subscription at any time from your account or by{" "}
        <a href="/contact">contacting us</a>. On cancellation, your plan remains
        active until the end of the current billing period, after which it
        reverts to the Free plan. You will not be charged again after cancelling.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>
          Because Pro unlocks digital features immediately, monthly fees are
          generally <strong>non-refundable</strong> once a billing cycle has
          started.
        </li>
        <li>
          If you were charged in error, or experienced a billing issue or a
          failure that prevented you from using Pro, contact us within{" "}
          <strong>7 days</strong> of the charge and we will review and, where
          appropriate, issue a full or pro-rated refund.
        </li>
        <li>
          Approved refunds are returned to the original payment method via
          Razorpay, typically within 5–10 business days.
        </li>
      </ul>

      <h2>How to request</h2>
      <p>
        Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with your account
        email and the payment reference. We aim to respond within 2 business days.
      </p>
    </LegalPage>
  );
}
