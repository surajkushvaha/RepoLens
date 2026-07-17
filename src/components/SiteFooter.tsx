import { FolderGit2, ArrowUpRight } from "lucide-react";
import { SITE, LEGAL_PAGES } from "@/lib/site";

// Shared site footer: branding, "developed by", social links, and the legal
// pages a standard product needs. Used on the landing page and every legal page.
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <span className="flex items-center gap-2 font-semibold">
            <FolderGit2 className="size-5 text-primary" /> {SITE.name}
          </span>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            {SITE.tagline}. AI-guided navigation with private, on-device search.
          </p>
          <p className="mt-4 text-sm">
            Developed by{" "}
            <a
              href={SITE.socials[1].href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              {SITE.author}
            </a>
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Company
          </p>
          <ul className="space-y-2 text-sm">
            {LEGAL_PAGES.map((p) => (
              <li key={p.href}>
                <a
                  href={p.href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Follow us
          </p>
          <ul className="space-y-2 text-sm">
            {SITE.socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  {s.label}
                  <ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} {SITE.name} · {SITE.author}. All rights
            reserved.
          </span>
          <span>
            Proprietary — free for local, personal, non-commercial use only.
          </span>
        </div>
      </div>
    </footer>
  );
}
