import { currentUser } from "@clerk/nextjs/server";

// Keep throwaway/temp-mail accounts out. Clerk lets anyone sign up, so we enforce
// two rules server-side on every gated request: the primary email must be
// VERIFIED, and its domain must not be a known disposable-mail provider. Result
// is cached per user (allowed accounts are stable) so we don't hit Clerk on
// every call.

// A pragmatic seed list of the highest-traffic disposable domains. Not
// exhaustive — it catches the common ones users reach for. Extend as needed.
const DISPOSABLE = new Set<string>([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "tempmail.dev",
  "tempmailo.com",
  "yopmail.com",
  "yopmail.net",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "trashmail.com",
  "trashmail.de",
  "throwawaymail.com",
  "fakeinbox.com",
  "maildrop.cc",
  "maildrop.cc",
  "mohmal.com",
  "moakt.com",
  "tempinbox.com",
  "emailondeck.com",
  "spam4.me",
  "mvrht.net",
  "inboxkitten.com",
  "mailnesia.com",
  "tempr.email",
  "discard.email",
  "1secmail.com",
  "1secmail.org",
  "1secmail.net",
  "g2email.com",
  "burnermail.io",
  "mintemail.com",
  "tmpmail.org",
  "tmail.ws",
  "luxusmail.org",
  "wegwerfemail.de",
]);

export type EmailVerdict = { ok: true } | { ok: false; reason: string };

// Cache verdicts briefly. Allowed users are stable; a short TTL still lets a
// newly-verified user re-check soon.
const cache = new Map<string, { verdict: EmailVerdict; exp: number }>();
const TTL_MS = 10 * 60 * 1000;

function domainOf(email: string): string {
  return email.split("@").pop()?.trim().toLowerCase() ?? "";
}

export function isDisposableDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (DISPOSABLE.has(d)) return true;
  // catch obvious subdomains of a blocked provider (e.g. foo.mailinator.com)
  return [...DISPOSABLE].some((bad) => d.endsWith("." + bad));
}

export async function checkEmail(userId: string): Promise<EmailVerdict> {
  const hit = cache.get(userId);
  if (hit && hit.exp > Date.now()) return hit.verdict;

  let verdict: EmailVerdict;
  try {
    const user = await currentUser();
    const primary = user?.primaryEmailAddress;
    if (!primary) {
      verdict = { ok: false, reason: "Add and verify an email address to continue." };
    } else if (primary.verification?.status !== "verified") {
      verdict = { ok: false, reason: "Verify your email address to continue." };
    } else if (isDisposableDomain(domainOf(primary.emailAddress))) {
      verdict = {
        ok: false,
        reason: "Disposable email addresses aren't allowed. Sign in with a permanent email.",
      };
    } else {
      verdict = { ok: true };
    }
  } catch {
    // If Clerk lookup fails, fail-open so a transient error never bricks the app.
    verdict = { ok: true };
  }

  // Only cache positive verdicts long; re-check rejections sooner in case the
  // user verifies or changes their email.
  cache.set(userId, { verdict, exp: Date.now() + (verdict.ok ? TTL_MS : 60_000) });
  return verdict;
}
