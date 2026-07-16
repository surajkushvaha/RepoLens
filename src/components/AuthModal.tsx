"use client";

import { useState } from "react";
import { FolderGit2, Loader2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, type Session } from "@/lib/auth/session";

// Sign-in / sign-up modal. Today it establishes the STOPGAP client session (see
// lib/auth/session.ts). The GitHub button is a placeholder for the BetterAuth
// OAuth flow that replaces this in the next phase; email creates a local session
// so the gated flow is demoable end-to-end.
export function AuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: (s: Session) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const session = signIn(email);
    onAuthed(session);
    setBusy(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="size-5 text-primary" />
            <span className="text-lg font-semibold">Welcome to RepoLens</span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X />
          </Button>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Create a free account to analyze repositories. No credit card — the
          free plan includes semantic visualization out of the box.
        </p>

        <Button variant="outline" className="mb-3 w-full" disabled title="Coming soon (BetterAuth OAuth)">
          <FolderGit2 /> Continue with GitHub
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            soon
          </span>
        </Button>

        <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or with email{" "}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : "Continue"}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          By continuing you agree to our Terms & Privacy. Your embeddings are
          computed and stored on your own device.
        </p>
      </div>
    </div>
  );
}
