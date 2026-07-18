import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} collects, uses and protects your data.`,
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="July 2026">
      <p>
        This Privacy Policy explains how <strong>{SITE.name}</strong> (operated by{" "}
        {SITE.author}) handles your information. We collect the minimum needed to
        run the Service.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — your email and basic profile, via our
          authentication provider (Clerk), when you sign in.
        </li>
        <li>
          <strong>Usage data</strong> — repositories you analyze, feature usage
          counts, and approximate token usage, stored to power your history and
          the usage dashboard.
        </li>
        <li>
          <strong>Billing data</strong> — if you subscribe to Pro, payments are
          processed by Razorpay. We store your plan status and a subscription
          reference; <strong>we never see or store your card details</strong>.
        </li>
        <li>
          <strong>Analytics</strong> — anonymous usage analytics via Google
          Analytics and Vercel Analytics to improve the product.
        </li>
      </ul>

      <h2>Your code &amp; how we cache it</h2>
      <p>
        Semantic search embeddings are computed <strong>in your browser</strong>{" "}
        via WebAssembly and cached locally (IndexedDB). To keep the product fast
        for everyone, the resulting embeddings and the corresponding code
        snippets from <strong>public repositories</strong> are also cached on our
        servers (Supabase), keyed by the repository&apos;s latest commit, so the
        same public repo isn&apos;t re-indexed by every visitor. AI-generated
        answers and summaries for public repositories are cached the same way.
        Because these repositories are already publicly available, no private
        code is exposed. We do not sell your data, and a new commit refreshes the
        cached copy.
      </p>

      <h2>Third-party processors</h2>
      <ul>
        <li>Clerk — authentication</li>
        <li>Supabase — database (history, plan, usage)</li>
        <li>Razorpay — payment processing</li>
        <li>Vercel — hosting &amp; analytics</li>
        <li>Google Analytics — usage analytics</li>
        <li>Hugging Face / jsDelivr — one-time download of the on-device model</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use cookies strictly necessary for authentication and session
        management, plus analytics cookies. You can control cookies through your
        browser settings.
      </p>

      <h2>Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your data. To
        delete your account and associated history, or to exercise any data right,{" "}
        <a href="/contact">contact us</a> at{" "}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy; material changes will be reflected on this page.
      </p>
    </LegalPage>
  );
}
