"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Cpu,
  FolderGit2,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";
import { startProCheckout } from "@/lib/billing/checkout";

type Payment = {
  payment_id: string | null;
  subscription_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  created_at: string;
};
type Billing = {
  plan: "free" | "pro";
  planSource: string | null;
  subscriptionId: string | null;
  payments: Payment[];
  proCheckoutAvailable: boolean;
};
type Usage = {
  plan: "free" | "pro";
  planSource?: string | null;
  used: number;
  limit: number;
  remaining: number;
  tokens: number;
};
type RecentRepo = {
  owner: string;
  repo: string;
  repo_url: string;
  open_count: number;
  last_opened_at: string;
};
type Event = {
  action: string;
  owner: string | null;
  repo: string | null;
  tokens: number;
  created_at: string;
};

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Dashboard() {
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<{
    usage: Usage;
    repos: RecentRepo[];
    events: Event[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [billing, setBilling] = useState<Billing | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch("/api/billing/history", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setBilling(d))
      .catch(() => {});
  }, [isLoaded, isSignedIn]);

  async function upgrade() {
    setUpgrading(true);
    try {
      await startProCheckout();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Checkout unavailable");
    } finally {
      setUpgrading(false);
    }
  }

  if (!isLoaded || loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Sign in to view your dashboard.</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft /> Back home
          </Button>
        </Link>
      </main>
    );
  }

  const u = data?.usage;
  const pct = u ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-6 py-8">
      <header className="mb-8 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft /> Home
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Usage</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            u?.plan === "pro"
              ? "bg-primary text-primary-foreground"
              : "border text-muted-foreground"
          }`}
        >
          {u?.plan === "pro" ? "Pro" : "Free"}
        </span>
        <ThemeToggle className="ml-auto" />
      </header>

      {/* stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="size-4" /> Credits today
          </div>
          <p className="mt-2 text-3xl font-semibold">
            {u?.used ?? 0}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / {u?.limit ?? 0}
            </span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {u?.remaining ?? 0} left — resets daily (UTC)
          </p>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cpu className="size-4" /> Tokens today
          </div>
          <p className="mt-2 text-3xl font-semibold">
            {(u?.tokens ?? 0).toLocaleString()}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            approximate AI tokens spent
          </p>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4" /> Plan
          </div>
          <p className="mt-2 text-3xl font-semibold capitalize">{u?.plan}</p>
          {u?.plan === "free" && billing?.proCheckoutAvailable ? (
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={upgrade}
              disabled={upgrading}
            >
              {upgrading ? <Loader2 className="animate-spin" /> : "Upgrade to Pro"}
            </Button>
          ) : u?.plan === "free" ? (
            <Button size="sm" className="mt-3 w-full" variant="outline" disabled>
              Coming soon
            </Button>
          ) : u?.planSource === "admin" ? (
            <p className="mt-3 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
              ✨ Your account was upgraded to Pro by an admin.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Thanks for supporting RepoLens ✨
            </p>
          )}
        </div>
      </div>

      {/* billing & payments */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Billing &amp; payments
        </h2>
        <div className="rounded-2xl border p-5">
          {billing?.plan === "pro" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                Active · Pro
              </span>
              {billing.planSource === "admin" && (
                <span className="text-xs text-muted-foreground">granted by admin</span>
              )}
              {billing.subscriptionId && (
                <span className="font-mono text-xs text-muted-foreground">
                  {billing.subscriptionId}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {billing?.proCheckoutAvailable
                  ? "You don't have an active subscription."
                  : "You don't have an active subscription. Pro checkout is coming soon."}
              </p>
              {billing?.proCheckoutAvailable ? (
                <Button size="sm" onClick={upgrade} disabled={upgrading}>
                  {upgrading ? <Loader2 className="animate-spin" /> : "Upgrade to Pro"}
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Coming soon
                </Button>
              )}
            </div>
          )}

          {billing && billing.payments.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Date</th>
                    <th className="py-1.5 pr-3 font-medium">Amount</th>
                    <th className="py-1.5 pr-3 font-medium">Transaction ID</th>
                    <th className="py-1.5 pr-3 font-medium">Reference</th>
                    <th className="py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.payments.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {p.amount != null
                          ? `${(p.amount / 100).toLocaleString()} ${p.currency ?? "INR"}`
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-3 font-mono">{p.payment_id ?? "—"}</td>
                      <td className="py-1.5 pr-3 font-mono">{p.subscription_id ?? "—"}</td>
                      <td className="py-1.5">{p.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No payments yet.</p>
          )}
        </div>
      </section>

      {/* repositories */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Repositories you&apos;ve explored
        </h2>
        {data?.repos.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {data.repos.map((r) => (
              <a
                key={`${r.owner}/${r.repo}`}
                // build the href from owner/repo, never from the stored URL —
                // avoids rendering an attacker-influenced javascript:/data: URI
                href={`https://github.com/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border px-4 py-3 font-mono text-sm hover:border-primary/50"
              >
                <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {r.owner}/{r.repo}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                  {r.open_count}×
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No repositories yet — analyze one from the home page.
          </p>
        )}
      </section>

      {/* activity */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Recent activity
        </h2>
        {data?.events.length ? (
          <div className="divide-y rounded-xl border">
            {data.events.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] capitalize text-muted-foreground">
                  {e.action}
                </span>
                <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                  {e.owner ? `${e.owner}/${e.repo}` : "—"}
                </span>
                {e.tokens > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.tokens.toLocaleString()} tok
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(e.created_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
      </section>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Your daily usage resets at 00:00 UTC.
      </p>
    </main>
  );
}
