// STOPGAP client session + device fingerprint.
//
// This is a UX placeholder so the "sign in before you analyze" gate and the
// freemium/abuse model have something to hang on TODAY. It is NOT security:
// a localStorage flag is trivially forged. Real enforcement lands with
// BetterAuth (server sessions, httpOnly cookies) + server-side plan/quota
// checks — see docs/STATUS-AND-ROADMAP.md ("Authentication" and "Abuse").
//
// Until then this gives us: a session object the UI can react to, and a stable
// per-device id used to attribute anonymous free-tier usage / rate limits.

const SESSION_KEY = "repolens.session.v1";
const FP_KEY = "repolens.device.v1";

export type Session = {
  email: string;
  name: string;
  plan: "free" | "pro";
  since: number;
};

const isBrowser = () => typeof window !== "undefined";

export function getSession(): Session | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function signIn(email: string, name?: string): Session {
  const session: Session = {
    email: email.trim().toLowerCase(),
    name: name?.trim() || email.split("@")[0],
    plan: "free",
    since: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("repolens:session"));
  return session;
}

export function signOut(): void {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("repolens:session"));
}

// Stable-ish device id: a random id persisted per browser, mixed with coarse
// UA/platform signals. Enough to attribute anonymous usage and flag obvious
// abuse; a determined attacker can reset it (hence: server-side checks too).
export function getDeviceId(): string {
  if (!isBrowser()) return "server";
  let id = localStorage.getItem(FP_KEY);
  if (!id) {
    const seed = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    ].join("|");
    id = hash(seed);
    localStorage.setItem(FP_KEY, id);
  }
  return id;
}

// Small non-cryptographic hash (FNV-1a) — just needs to be stable and compact.
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
