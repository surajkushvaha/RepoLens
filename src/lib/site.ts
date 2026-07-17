// Single source of truth for site identity — used by metadata, structured data,
// the sitemap, the footer, and the legal pages.

export const SITE = {
  name: "RepoLens",
  tagline: "Explore any codebase as a living map",
  description:
    "Paste a GitHub repo and fly through its architecture. AI-guided code navigation — interactive dependency graph, in-browser semantic search, file explanations, and natural-language Q&A — instead of a static folder tree.",
  // Public production URL. Override with NEXT_PUBLIC_SITE_URL in the env.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://repo-lens-one.vercel.app",
  author: "Suraj Kushvaha",
  email: "suraj04patel@gmail.com",
  gaId: "G-GDJ3Y8EHFP",
  socials: [
    { label: "GitHub", handle: "@surajkushvaha", href: "https://github.com/surajkushvaha" },
    { label: "Portfolio", handle: "surajkushvaha.vercel.app", href: "https://surajkushvaha.vercel.app" },
    { label: "X (Twitter)", handle: "@surajkushvaha0", href: "https://x.com/surajkushvaha0" },
    { label: "LinkedIn", handle: "@surajkushvaha", href: "https://www.linkedin.com/in/surajkushvaha" },
    { label: "Facebook", handle: "surajkushvaha04", href: "https://www.facebook.com/surajkushvaha04" },
    { label: "Instagram", handle: "suraj_kushvaha", href: "https://www.instagram.com/suraj_kushvaha" },
  ],
} as const;

export const LEGAL_PAGES = [
  { href: "/about", label: "About" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund & Cancellation" },
  { href: "/contact", label: "Contact" },
] as const;
