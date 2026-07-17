import { currentUser } from "@clerk/nextjs/server";

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
