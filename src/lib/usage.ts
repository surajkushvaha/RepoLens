import { supabaseAdmin } from "@/utils/supabase/server";
import { dailyCredits, type Plan, type BillableAction } from "@/lib/billing/plans";

// Usage + plan accounting, all server-side via the service-role client and
// scoped by Clerk user id. Fail-open: if Supabase isn't configured, quota checks
// allow the request (so a missing key never bricks the app) — real enforcement
// switches on once SUPABASE_SERVICE_ROLE_KEY is present.

export type Usage = {
  plan: Plan;
  planSource: string | null; // 'admin' | 'razorpay' | null
  used: number; // billable actions today
  limit: number; // daily credit allowance
  remaining: number;
  tokens: number; // approximate tokens today
};

const startOfUtcDay = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

export async function getPlan(userId: string): Promise<Plan> {
  const db = supabaseAdmin();
  if (!db) return "free";
  try {
    const { data } = await db
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.plan as Plan) ?? "free";
  } catch {
    return "free";
  }
}

// Runtime-tunable base limit per plan. Set FREE_DAILY_CREDITS / PRO_DAILY_CREDITS
// in the env to change the allowance without a deploy of the code defaults.
function baseLimit(plan: Plan): number {
  const raw = plan === "free" ? process.env.FREE_DAILY_CREDITS : process.env.PRO_DAILY_CREDITS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dailyCredits(plan);
}

// Per-user bonus credits granted by an admin. Fetched separately (and fail-safe)
// so quota keeps working even before the bonus_credits column migration runs.
async function getBonus(userId: string): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  try {
    const { data, error } = await db
      .from("profiles")
      .select("bonus_credits")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return 0;
    return Math.max(0, Number(data?.bonus_credits ?? 0));
  } catch {
    return 0;
  }
}

// Effective daily allowance = plan base (env-tunable) + admin-granted bonus.
async function effectiveLimit(userId: string, plan: Plan): Promise<number> {
  return baseLimit(plan) + (await getBonus(userId));
}

// How the user got their plan. Fail-safe if the column isn't there yet.
async function getPlanSource(userId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("profiles")
      .select("plan_source")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null;
    return (data?.plan_source as string) ?? null;
  } catch {
    return null;
  }
}

// Set a user's plan (called from the Razorpay webhook / verify).
export async function setPlan(
  userId: string,
  plan: Plan,
  fields: Partial<{
    razorpay_customer_id: string;
    razorpay_subscription_id: string;
    plan_source: string | null;
  }> = {},
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db.from("profiles").upsert(
    {
      user_id: userId,
      plan,
      plan_updated_at: new Date().toISOString(),
      ...fields,
    },
    { onConflict: "user_id" },
  );
}

// Store the subscription id we created for this user (at checkout start), so
// verification can confirm a returned subscription actually belongs to them.
export async function linkSubscription(
  userId: string,
  subscriptionId: string,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db
    .from("profiles")
    .upsert(
      { user_id: userId, razorpay_subscription_id: subscriptionId },
      { onConflict: "user_id" },
    );
}

export async function getSubscriptionId(userId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  try {
    const { data } = await db
      .from("profiles")
      .select("razorpay_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.razorpay_subscription_id as string) ?? null;
  } catch {
    return null;
  }
}

// Count today's billable actions + tokens for a user.
async function today(
  userId: string,
): Promise<{ count: number; tokens: number }> {
  const db = supabaseAdmin();
  if (!db) return { count: 0, tokens: 0 };
  const { data } = await db
    .from("usage_events")
    .select("tokens")
    .eq("user_id", userId)
    .gte("created_at", startOfUtcDay());
  const rows = data ?? [];
  return {
    count: rows.length,
    tokens: rows.reduce((s, r) => s + (r.tokens ?? 0), 0),
  };
}

export async function getUsage(userId: string): Promise<Usage> {
  const plan = await getPlan(userId);
  const [limit, planSource, day] = await Promise.all([
    effectiveLimit(userId, plan),
    getPlanSource(userId),
    today(userId),
  ]);
  return {
    plan,
    planSource,
    used: day.count,
    limit,
    remaining: Math.max(0, limit - day.count),
    tokens: day.tokens,
  };
}

// Quota gate for billable actions. Fail-open when Supabase is unconfigured.
export async function checkQuota(
  userId: string,
): Promise<{ allowed: boolean; plan: Plan; used: number; limit: number }> {
  const db = supabaseAdmin();
  if (!db) return { allowed: true, plan: "free", used: 0, limit: baseLimit("free") };
  const plan = await getPlan(userId);
  const limit = await effectiveLimit(userId, plan);
  const { count } = await today(userId);
  return { allowed: count < limit, plan, used: count, limit };
}

// Record one usage event. Never throws.
export async function recordUsage(
  userId: string,
  action: BillableAction,
  meta: { owner?: string; repo?: string; tokens?: number } = {},
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  try {
    await db.from("usage_events").insert({
      user_id: userId,
      action,
      owner: meta.owner ?? null,
      repo: meta.repo ?? null,
      tokens: Math.max(0, Math.round(meta.tokens ?? 0)),
    });
  } catch (err) {
    console.error("[usage] record failed", err);
  }
}

export type UsageEvent = {
  action: string;
  owner: string | null;
  repo: string | null;
  tokens: number;
  created_at: string;
};

// Recent usage events for the dashboard activity feed.
export async function recentEvents(
  userId: string,
  limit = 20,
): Promise<UsageEvent[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from("usage_events")
      .select("action, owner, repo, tokens, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as UsageEvent[]) ?? [];
  } catch {
    return [];
  }
}

// Rough token estimate when the provider doesn't report usage (~4 chars/token).
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

// ---- admin -----------------------------------------------------------------

// Grant (or clear) per-user bonus daily credits. Admin-only via /api/admin.
export async function setBonusCredits(userId: string, bonus: number): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db.from("profiles").upsert(
    { user_id: userId, bonus_credits: Math.max(0, Math.round(bonus)) },
    { onConflict: "user_id" },
  );
}

export type AdminUser = {
  userId: string;
  email?: string;
  name?: string;
  plan: Plan;
  bonusCredits: number;
  limit: number;
  usedToday: number;
  tokensToday: number;
};

export type AdminOverview = {
  stats: { totalUsers: number; pro: number; free: number; actionsToday: number; tokensToday: number };
  users: AdminUser[];
};

// Platform snapshot for the admin dashboard: every known user (from profiles and
// from today's activity) with their plan, bonus, effective limit, and today's
// usage. Fail-safe if Supabase (or the bonus_credits column) isn't there yet.
export async function adminOverview(): Promise<AdminOverview> {
  const empty: AdminOverview = {
    stats: { totalUsers: 0, pro: 0, free: 0, actionsToday: 0, tokensToday: 0 },
    users: [],
  };
  const db = supabaseAdmin();
  if (!db) return empty;

  // profiles (with graceful fallback if bonus_credits column is missing)
  type ProfileRow = { user_id: string; plan?: string; bonus_credits?: number };
  let profiles: ProfileRow[] = [];
  {
    const withBonus = await db.from("profiles").select("user_id, plan, bonus_credits");
    if (withBonus.error) {
      const basic = await db.from("profiles").select("user_id, plan");
      profiles = (basic.data as ProfileRow[]) ?? [];
    } else {
      profiles = (withBonus.data as ProfileRow[]) ?? [];
    }
  }

  // today's usage events, aggregated per user
  const { data: events } = await db
    .from("usage_events")
    .select("user_id, tokens, created_at")
    .gte("created_at", startOfUtcDay());
  const rows = events ?? [];

  const agg = new Map<string, { used: number; tokens: number }>();
  for (const e of rows) {
    const a = agg.get(e.user_id) ?? { used: 0, tokens: 0 };
    a.used += 1;
    a.tokens += e.tokens ?? 0;
    agg.set(e.user_id, a);
  }

  const byUser = new Map<string, AdminUser>();
  const put = (userId: string, plan: Plan, bonus: number) => {
    const a = agg.get(userId) ?? { used: 0, tokens: 0 };
    byUser.set(userId, {
      userId,
      plan,
      bonusCredits: bonus,
      limit: baseLimit(plan) + bonus,
      usedToday: a.used,
      tokensToday: a.tokens,
    });
  };
  for (const p of profiles) {
    put(p.user_id, (p.plan as Plan) ?? "free", Math.max(0, Number(p.bonus_credits ?? 0)));
  }
  // include active users who have no profile row yet (free, never upgraded)
  for (const userId of agg.keys()) {
    if (!byUser.has(userId)) put(userId, "free", 0);
  }

  const users = [...byUser.values()].sort((a, b) => b.usedToday - a.usedToday);
  return {
    stats: {
      totalUsers: users.length,
      pro: users.filter((u) => u.plan === "pro").length,
      free: users.filter((u) => u.plan === "free").length,
      actionsToday: rows.length,
      tokensToday: rows.reduce((s, r) => s + (r.tokens ?? 0), 0),
    },
    users,
  };
}
