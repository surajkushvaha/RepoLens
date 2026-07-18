"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

// Optimistic "the AI is working" indicator, used everywhere content is being
// generated (Ask, Chat, Architecture overview, README, per-file summaries).
// Cycles through a few playful, context-appropriate status lines so the wait
// feels alive instead of a dead skeleton.

export const THINKING_PHRASES = {
  ask: [
    "Thinking about your question",
    "Exploring the codebase",
    "Reading the most relevant files",
    "Connecting the dots",
    "Still untangling that one",
    "Composing an answer",
  ],
  chat: [
    "Thinking about your question",
    "Recalling the conversation",
    "Exploring the codebase",
    "Cross-checking the files",
    "Composing a reply",
  ],
  architecture: [
    "Surveying the repo",
    "Mapping the modules",
    "Spotting the entry points",
    "Puzzling out the structure",
    "Drafting the overview",
  ],
  readme: [
    "Reading the whole repo",
    "Outlining the sections",
    "Drafting the README",
    "Polishing the wording",
    "Almost done writing",
  ],
  summary: [
    "Reading this file",
    "Working out what it does",
    "Spotting the key exports",
    "Writing the summary",
  ],
} as const;

export function Thinking({
  phrases = THINKING_PHRASES.ask,
  compact = false,
}: {
  phrases?: readonly string[];
  compact?: boolean;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % phrases.length), 1600);
    return () => clearInterval(t);
  }, [phrases]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 animate-pulse text-primary" />
        <span
          key={i}
          className="animate-in fade-in slide-in-from-bottom-1 bg-gradient-to-r from-primary via-foreground to-primary bg-[length:200%_100%] bg-clip-text font-medium text-transparent"
          style={{ animation: "repolens-shimmer 2s linear infinite" }}
        >
          {phrases[i]}
        </span>
        <span className="flex gap-0.5">
          <Dot delay={0} />
          <Dot delay={150} />
          <Dot delay={300} />
        </span>
      </div>
      {/* faint skeleton lines underneath for structure */}
      <div className="space-y-2 opacity-40">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-[85%] animate-pulse rounded bg-muted" />
        {!compact && <div className="h-3 w-[70%] animate-pulse rounded bg-muted" />}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block size-1 rounded-full bg-primary"
      style={{ animation: "repolens-bounce 1s ease-in-out infinite", animationDelay: `${delay}ms` }}
    />
  );
}
