import { currentUser, clerkClient } from "@clerk/nextjs/server";

// Who may reach the admin dashboard. Configure ADMIN_EMAILS (comma-separated) in
// the env — e.g. ADMIN_EMAILS="suraj04patel@gmail.com,you@example.com". A user is
// an admin when their VERIFIED primary email is on that list. Empty list = no
// admins (the dashboard is locked to everyone), which is the safe default.

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function isAdmin(): Promise<boolean> {
  if (ADMIN_EMAILS.length === 0) return false;
  try {
    const user = await currentUser();
    const primary = user?.primaryEmailAddress;
    if (!primary || primary.verification?.status !== "verified") return false;
    return ADMIN_EMAILS.includes(primary.emailAddress.toLowerCase());
  } catch {
    return false;
  }
}

// Look up display info (email + name) for a batch of Clerk user ids, so the
// admin table shows who each row actually is instead of an opaque user_xxx id.
export async function lookupClerkUsers(
  userIds: string[],
): Promise<Map<string, { email?: string; name?: string }>> {
  const map = new Map<string, { email?: string; name?: string }>();
  if (userIds.length === 0) return map;
  try {
    const client = await clerkClient();
    const res = await client.users.getUserList({ userId: userIds, limit: 100 });
    for (const u of res.data) {
      const email =
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
        u.emailAddresses[0]?.emailAddress;
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || undefined;
      map.set(u.id, { email, name: name ?? undefined });
    }
  } catch (err) {
    console.error("[admin] clerk user lookup failed", err);
  }
  return map;
}
