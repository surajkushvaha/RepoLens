import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${SITE.name} — support, feedback, and licensing.`,
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <LegalPage title="Contact">
      <p>
        Questions, feedback, support, or commercial-licensing enquiries — reach
        out and we&apos;ll get back to you.
      </p>

      <h2>Email</h2>
      <p>
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
      </p>

      <h2>Follow &amp; connect</h2>
      <ul>
        {SITE.socials.map((s) => (
          <li key={s.label}>
            <strong>{s.label}:</strong>{" "}
            <a href={s.href} target="_blank" rel="noreferrer">
              {s.handle}
            </a>
          </li>
        ))}
      </ul>

      <h2>Built by</h2>
      <p>
        {SITE.name} is developed and maintained by{" "}
        <a href={SITE.socials[1].href} target="_blank" rel="noreferrer">
          {SITE.author}
        </a>
        .
      </p>
    </LegalPage>
  );
}
