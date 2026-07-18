"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

// Optimistic "the AI is working" indicator for the Q&A panel. Cycles through a
// few playful status lines while the answer is being retrieved + streamed, so
// the wait feels alive instead of a dead skeleton.
const PHRASES = [
  "Thinking about your question",
  "Exploring the codebase",
  "Reading the most relevant files",
  "Connecting the dots",
  "Composing an answer",
];

export function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PHRASES.length), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 animate-pulse text-primary" />
        <span
          key={i}
          className="animate-in fade-in slide-in-from-bottom-1 bg-gradient-to-r from-primary via-foreground to-primary bg-[length:200%_100%] bg-clip-text font-medium text-transparent"
          style={{ animation: "repolens-shimmer 2s linear infinite" }}
        >
          {PHRASES[i]}
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
        <div className="h-3 w-[70%] animate-pulse rounded bg-muted" />
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
