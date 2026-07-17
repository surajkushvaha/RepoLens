import { supabaseAdmin } from "@/utils/supabase/server";
import { dailyCredits, type Plan, type BillableAction } from "@/lib/billing/plans";

// Usage + plan accounting, all server-side via the service-role client and
// scoped by Clerk user id. Fail-open: if Supabase isn't configured, quota checks
// allow the request (so a missing key never bricks the app) — real enforcement
// switches on once SUPABASE_SERVICE_ROLE_KEY is present.

export type Usage = {
  plan: Plan;
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

// Set a user's plan (called from the Razorpay webhook / verify).
export async function setPlan(
  userId: string,
  plan: Plan,
  fields: Partial<{
    razorpay_customer_id: string;
    razorpay_subscription_id: string;
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
  const limit = dailyCredits(plan);
  const { count, tokens } = await today(userId);
  return { plan, used: count, limit, remaining: Math.max(0, limit - count), tokens };
}

// Quota gate for billable actions. Fail-open when Supabase is unconfigured.
export async function checkQuota(
  userId: string,
): Promise<{ allowed: boolean; plan: Plan; used: number; limit: number }> {
  const db = supabaseAdmin();
  if (!db) return { allowed: true, plan: "free", used: 0, limit: dailyCredits("free") };
  const plan = await getPlan(userId);
  const limit = dailyCredits(plan);
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
