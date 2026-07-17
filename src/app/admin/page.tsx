"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, LockKeyhole, Shield, Users, Zap, Cpu } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme";
import { toast } from "sonner";

type AdminUser = {
  userId: string;
  email?: string;
  name?: string;
  plan: "free" | "pro";
  bonusCredits: number;
  limit: number;
  usedToday: number;
  tokensToday: number;
};
type Overview = {
  stats: { totalUsers: number; pro: number; free: number; actionsToday: number; tokensToday: number };
  users: AdminUser[];
};

export default function AdminPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { plan: "free" | "pro"; bonus: number }>>({});

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin");
      if (res.status === 404 || res.status === 401) {
        setAuthorized(false);
        return;
      }
      const d: Overview = await res.json();
      setData(d);
      setAuthorized(true);
    } catch {
      toast("Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
  }, [isLoaded, load]);

  // Non-admins who ARE signed in get quietly sent to their own dashboard.
  useEffect(() => {
    if (!loading && !authorized && isSignedIn) {
      const t = setTimeout(() => router.push("/dashboard"), 3500);
      return () => clearTimeout(t);
    }
  }, [loading, authorized, isSignedIn, router]);

  async function save(u: AdminUser) {
    const d = draft[u.userId] ?? { plan: u.plan, bonus: u.bonusCredits };
    setSavingId(u.userId);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.userId, plan: d.plan, bonusCredits: d.bonus }),
      });
      if (!res.ok) {
        toast("Update failed.");
        return;
      }
      const fresh: Overview = await res.json();
      setData(fresh);
      setDraft((prev) => {
        const next = { ...prev };
        delete next[u.userId];
        return next;
      });
      toast(`Updated ${u.userId.slice(0, 12)}…`);
    } catch {
      toast("Update failed.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        {/* self-contained animated "no access" badge — no external assets */}
        <div className="relative flex size-24 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/20" />
          <span className="absolute inline-flex size-20 rounded-full bg-destructive/10" />
          <div className="relative flex size-16 items-center justify-center rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/30">
            <LockKeyhole className="size-7" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-widest text-destructive/80">
            403 · Forbidden
          </p>
          <h1 className="text-2xl font-semibold">Access restricted</h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
        </div>
        {isSignedIn ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <Link href="/dashboard">
                <Button size="sm">
                  Go to dashboard <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="sm">
                  Home
                </Button>
              </Link>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Redirecting you to your dashboard…
            </p>
          </div>
        ) : (
          <Link href="/">
            <Button size="sm">
              <ArrowLeft className="size-4" /> Back home
            </Button>
          </Link>
        )}
      </div>
    );
  }

  const stats = data?.stats;
  const users = data?.users ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="size-5 text-primary" /> Admin
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat icon={<Users className="size-4" />} label="Users" value={stats?.totalUsers ?? 0} />
        <Stat label="Pro" value={stats?.pro ?? 0} />
        <Stat label="Free" value={stats?.free ?? 0} />
        <Stat icon={<Zap className="size-4" />} label="Actions today" value={stats?.actionsToday ?? 0} />
        <Stat icon={<Cpu className="size-4" />} label="Tokens today" value={stats?.tokensToday ?? 0} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Bonus/day</th>
              <th className="px-3 py-2 font-medium">Limit</th>
              <th className="px-3 py-2 font-medium">Used today</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No users with activity yet.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const d = draft[u.userId] ?? { plan: u.plan, bonus: u.bonusCredits };
              const dirty = d.plan !== u.plan || d.bonus !== u.bonusCredits;
              return (
                <tr key={u.userId} className="border-b last:border-0">
                  <td className="px-3 py-2" title={u.userId}>
                    <div className="font-medium">
                      {u.name ?? u.email ?? `${u.userId.slice(0, 16)}…`}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {u.email ?? u.userId}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                      value={d.plan}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [u.userId]: { ...d, plan: e.target.value as "free" | "pro" },
                        }))
                      }
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-24"
                      value={d.bonus}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [u.userId]: { ...d, bonus: Math.max(0, Number(e.target.value) || 0) },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{u.limit}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.usedToday} · {u.tokensToday} tok
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant={dirty ? "default" : "outline"}
                      disabled={!dirty || savingId === u.userId}
                      onClick={() => save(u)}
                    >
                      {savingId === u.userId ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Bonus credits are added on top of the plan&apos;s daily limit for that user.
        To change the base limit for everyone, set{" "}
        <code className="rounded bg-muted px-1 py-0.5">FREE_DAILY_CREDITS</code> /{" "}
        <code className="rounded bg-muted px-1 py-0.5">PRO_DAILY_CREDITS</code> in the env.
      </p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
