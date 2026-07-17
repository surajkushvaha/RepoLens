import Link from "next/link";
import { FolderGit2 } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/theme";

// Consistent shell for content pages (About, Terms, Privacy, Refund, Contact):
// a slim header, a readable prose column, and the shared footer.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FolderGit2 className="size-5 text-primary" /> RepoLens
          </Link>
          <ThemeToggle className="ml-auto" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {updated && (
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {updated}
          </p>
        )}
        <div className="prose-legal mt-8 space-y-5 text-sm leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-foreground">
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
