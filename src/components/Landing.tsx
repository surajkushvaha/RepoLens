"use client";

import {
  ArrowRight,
  Check,
  Cpu,
  FolderGit2,
  Loader2,
  LockKeyhole,
  Network,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme";
import { SiteFooter } from "@/components/SiteFooter";
import { startProCheckout } from "@/lib/billing/checkout";
import { toast } from "sonner";

type Props = {
  url: string;
  setUrl: (v: string) => void;
  onAnalyze: (e: React.FormEvent) => void;
  onPick: (repoUrl: string) => void;
  loading: boolean;
};

type RecentRepo = { owner: string; repo: string; repo_url: string };

const FEATURES = [
  {
    icon: Network,
    title: "Living architecture map",
    body: "Every module and its imports rendered as an interactive graph. Fly through the structure, expand modules into files, and follow the dependencies.",
  },
  {
    icon: Cpu,
    title: "In-browser semantic search",
    body: "Embeddings run locally via WebAssembly and persist in your browser. Ask by meaning, not keywords — your code never leaves the device.",
  },
  {
    icon: Sparkles,
    title: "AI that reads the repo",
    body: "Architecture overviews, per-file summaries, a generated README, and grounded Q&A that highlights the exact files behind every answer.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Everything you need to explore public code.",
    features: [
      "Public GitHub repositories",
      "Interactive architecture & knowledge graph",
      "In-browser semantic search (private, on-device)",
      "AI Q&A, summaries & README — 25 / day",
      "5 repositories cached locally",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$9",
    cadence: "/ month",
    tagline: "For engineers living in unfamiliar code.",
    features: [
      "Everything in Free",
      "Private repositories (read-only OAuth)",
      "Unlimited AI Q&A & summaries (fair use)",
      "Larger repos & higher file limits",
      "Priority models & saved history",
    ],
    cta: "Go Pro",
    highlight: true,
  },
];

export function Landing({ url, setUrl, onAnalyze, onPick, loading }: Props) {
  const { isSignedIn } = useAuth();
  const [recent, setRecent] = useState<RecentRepo[]>([]);
  const [plan, setPlan] = useState<"free" | "pro" | null>(null);

  // load the signed-in user's recent repos + current plan (Clerk-authenticated)
  useEffect(() => {
    if (!isSignedIn) {
      setRecent([]);
      setPlan(null);
      return;
    }
    let alive = true;
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => alive && setRecent(d.recent ?? []))
      .catch(() => {});
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => alive && setPlan(d?.usage?.plan ?? "free"))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isSignedIn]);

  return (
    <div className="relative min-h-dvh overflow-y-auto">
      {/* backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, var(--primary) 0, transparent 45%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklch, var(--foreground) 8%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 8%, transparent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-border/30 bg-background/20 backdrop-blur-xl supports-[backdrop-filter]:bg-background/10">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <a href="#top" className="flex items-center gap-2 font-semibold">
            <FolderGit2 className="size-5 text-primary" />
            RepoLens
          </a>
          <a
            href="#about"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            About
          </a>
          <a
            href="#plans"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Plans
          </a>
          <ThemeToggle />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Sign up</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <a
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </a>
            <UserButton />
          </Show>
        </nav>
      </header>

      {/* hero */}
      <section
        id="top"
        className="mx-auto flex max-w-2xl flex-col items-center px-6 pb-20 pt-24 text-center sm:pt-32"
      >
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          codebase navigator
        </span>

        <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
          Explore any codebase as a{" "}
          <span className="bg-gradient-to-r from-chart-1 via-chart-4 to-chart-2 bg-clip-text text-transparent">
            living map
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted-foreground">
          Paste a GitHub repo and fly through its architecture. Ask questions,
          follow the code, understand in minutes — not days.
        </p>

        <form
          onSubmit={onAnalyze}
          className="mx-auto mt-9 flex w-full max-w-lg items-center gap-2"
        >
          <div className="relative flex-1">
            <FolderGit2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="h-11 pl-9 font-mono text-sm"
            />
          </div>
          <Button type="submit" size="lg" disabled={loading} className="h-11">
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                Analyze <ArrowRight />
              </>
            )}
          </Button>
        </form>

        <p className="mt-4 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          {isSignedIn ? (
            "public repos · any language · on-device search"
          ) : (
            <>
              <LockKeyhole className="size-3" /> sign in to analyze — free, no card
            </>
          )}
        </p>

        {recent.length > 0 && (
          <div className="mt-8 w-full max-w-lg">
            <p className="mb-2 text-left font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Recent
            </p>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={`${r.owner}/${r.repo}`}
                  onClick={() => onPick(`https://github.com/${r.owner}/${r.repo}`)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  <FolderGit2 className="size-3" />
                  {r.owner}/{r.repo}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* about / features */}
      <section id="about" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          Understand code by exploring it
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          RepoLens turns a repository into an interactive map, backed by AI and
          a semantic index that runs right in your browser.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card/40 p-6">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                <f.icon className="size-5 text-primary" />
              </div>
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* plans / pricing */}
      <section id="plans" className="mx-auto max-w-4xl scroll-mt-16 px-6 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          Simple, honest pricing
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Start free — semantic visualization is on the house. Upgrade when you
          need private repos and heavier AI.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-7 ${
                p.highlight
                  ? "border-primary/50 bg-card/60 shadow-lg"
                  : "bg-card/30"
              }`}
            >
              {p.highlight && (
                <span className="absolute right-6 top-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                  Popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">
                  {p.price}
                </span>
                <span className="text-sm text-muted-foreground">{p.cadence}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.tagline}</p>
              <ul className="mt-6 space-y-3">
                {p.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <Button
                    className="mt-7 w-full"
                    variant={p.highlight ? "default" : "outline"}
                  >
                    {p.cta}
                  </Button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                {(p.highlight && plan === "pro") ||
                (!p.highlight && plan === "free") ? (
                  // this card is the user's current plan
                  <Button className="mt-7 w-full" variant="outline" disabled>
                    <Check className="size-4" /> Current plan
                  </Button>
                ) : p.highlight ? (
                  // Pro card, user is on Free -> upgrade
                  <Button
                    className="mt-7 w-full"
                    onClick={() =>
                      startProCheckout().catch((e) =>
                        toast(
                          e instanceof Error && e.message
                            ? e.message
                            : "Pro checkout is being finalized — please check back soon.",
                        ),
                      )
                    }
                  >
                    {p.cta}
                  </Button>
                ) : (
                  // Free card, user is on Pro -> nothing to buy
                  <a href="#top" className="mt-7 block">
                    <Button className="w-full" variant="outline">
                      Analyze a repo
                    </Button>
                  </a>
                )}
              </Show>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pricing is indicative while billing is finalized. Pro checkout is
          coming soon.
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}
