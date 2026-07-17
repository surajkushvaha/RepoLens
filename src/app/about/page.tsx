import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `About ${SITE.name} — ${SITE.tagline}. Built by ${SITE.author}.`,
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <LegalPage title="About RepoLens">
      <p>
        <strong>{SITE.name}</strong> turns any GitHub repository into an
        interactive, living map instead of a static folder tree. Paste a repo and
        fly through its architecture, follow the dependencies, and ask questions
        in plain language — understand a project in minutes, not days.
      </p>

      <h2>What it does</h2>
      <ul>
        <li>Interactive architecture &amp; dependency graph for any language.</li>
        <li>Symbol-level knowledge graph of functions, classes and interfaces.</li>
        <li>
          In-browser <strong>semantic search</strong> — embeddings run on your
          own device via WebAssembly, so your code never leaves the browser.
        </li>
        <li>
          AI architecture overviews, per-file summaries, README generation, and
          grounded natural-language Q&amp;A.
        </li>
        <li>Per-user history and a usage dashboard.</li>
      </ul>

      <h2>Who built it</h2>
      <p>
        RepoLens is designed, built and maintained by{" "}
        <a href={SITE.socials[1].href} target="_blank" rel="noreferrer">
          {SITE.author}
        </a>
        . Follow along on{" "}
        <a href={SITE.socials[0].href} target="_blank" rel="noreferrer">
          GitHub
        </a>
        ,{" "}
        <a href={SITE.socials[2].href} target="_blank" rel="noreferrer">
          X
        </a>{" "}
        and{" "}
        <a href={SITE.socials[3].href} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        .
      </p>

      <h2>Licensing</h2>
      <p>
        RepoLens is <strong>proprietary software</strong>. It may be used locally
        for personal, non-commercial purposes. Commercial use, redistribution, or
        deployment for commercial purposes requires explicit written permission
        from {SITE.author}. See the{" "}
        <a href="/terms">Terms &amp; Conditions</a> for details.
      </p>
    </LegalPage>
  );
}
