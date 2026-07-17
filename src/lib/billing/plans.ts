// Plan definitions — the single source of truth for limits and pricing.
// Only two plans: free and pro. Prices are indicative (Razorpay Plan is the
// billing source of truth); the daily limit is what the server actually enforces.

export type Plan = "free" | "pro";

export const PLANS: Record<
  Plan,
  { label: string; dailyCredits: number; priceInr: number }
> = {
  // One "credit" = one AI action (Q&A, summary, architecture, README, knowledge).
  // These are the base defaults; the server can override per-plan at runtime via
  // FREE_DAILY_CREDITS / PRO_DAILY_CREDITS env, and admins can grant per-user
  // bonus credits on top (see lib/usage.ts).
  free: { label: "Free", dailyCredits: 100, priceInr: 0 },
  pro: { label: "Pro", dailyCredits: 1000, priceInr: 749 }, // ~$9/mo, fair-use cap
};

// Which actions consume a credit. Cheap/free actions (literal search, source
// delivery, analyze) require auth but don't draw down the AI quota.
export const BILLABLE_ACTIONS = [
  "ask",
  "summarize",
  "architecture",
  "readme",
  "knowledge",
] as const;
export type BillableAction =
  | (typeof BILLABLE_ACTIONS)[number]
  | "analyze"
  | "search"
  | "source";

export const dailyCredits = (plan: Plan) => PLANS[plan].dailyCredits;
