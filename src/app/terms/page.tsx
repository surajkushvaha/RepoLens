import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms and Conditions for using ${SITE.name}.`,
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <LegalPage title="Terms & Conditions" updated="July 2026">
      <p>
        These Terms &amp; Conditions (&quot;Terms&quot;) govern your use of{" "}
        <strong>{SITE.name}</strong> (the &quot;Service&quot;), operated by{" "}
        {SITE.author} (&quot;we&quot;, &quot;us&quot;). By accessing or using the
        Service you agree to these Terms. If you do not agree, do not use the
        Service.
      </p>

      <h2>1. Licence &amp; permitted use</h2>
      <p>
        RepoLens is <strong>proprietary software</strong>. You are granted a
        limited, non-exclusive, non-transferable right to use the Service and to
        run the software <strong>locally for personal, non-commercial</strong>{" "}
        evaluation only. <strong>Commercial use</strong>, redistribution,
        sublicensing, resale, or hosting the software for commercial purposes is{" "}
        <strong>prohibited</strong> without prior written permission from{" "}
        {SITE.author}, who retains all rights, title and interest in the Service.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Some features require an account, provided via our authentication
        partner. You are responsible for activity under your account and for
        keeping your credentials secure. You must provide accurate information and
        be legally able to enter into these Terms.
      </p>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>Do not attempt to break, overload, or circumvent the Service, its rate limits, quotas, or billing.</li>
        <li>Do not use the Service to process content you have no right to access.</li>
        <li>Do not reverse engineer, scrape, or resell the Service except as permitted by law.</li>
      </ul>

      <h2>4. Repositories &amp; content</h2>
      <p>
        The Service analyzes public repositories you submit. You are responsible
        for ensuring you have the right to analyze any repository you provide. We
        do not claim ownership of third-party code. AI-generated output may be
        inaccurate — verify before relying on it.
      </p>

      <h2>5. Plans &amp; payment</h2>
      <p>
        The Service offers a Free plan and a paid <strong>Pro</strong> plan.
        Paid subscriptions are billed through our payment processor (Razorpay).
        By subscribing you authorise recurring charges until you cancel. See our{" "}
        <a href="/refund">Refund &amp; Cancellation Policy</a>.
      </p>

      <h2>6. Disclaimer &amp; limitation of liability</h2>
      <p>
        The Service is provided <strong>&quot;as is&quot;</strong> without
        warranties of any kind. To the maximum extent permitted by law, {SITE.author}{" "}
        shall not be liable for any indirect, incidental, or consequential
        damages, or for any loss arising from your use of, or reliance on, the
        Service or its AI output.
      </p>

      <h2>7. Termination</h2>
      <p>
        We may suspend or terminate access that violates these Terms. You may stop
        using the Service at any time.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these Terms. Continued use after changes constitutes
        acceptance.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions? <a href="/contact">Contact us</a> or email{" "}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    </LegalPage>
  );
}
