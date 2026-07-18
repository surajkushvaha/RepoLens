"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type FileType = { ext: string; count: number; bytes: number };
type Author = { name: string; count: number };
type Activity = { date: string; count: number };
type Data = {
  fileTypes: FileType[];
  totalFiles: number;
  authors: Author[];
  activity: Activity[];
  totalCommits: number;
  commitsCapped: boolean;
};

// Bright, neon-ish palette that reads well on both light and dark, matching the
// graph's vibe. No external chart lib — all inline SVG (CSP-safe).
const PALETTE = [
  "#22d3ee", "#a78bfa", "#34d399", "#f59e0b", "#f472b6",
  "#60a5fa", "#f87171", "#facc15", "#4ade80", "#c084fc",
];

export function Insights({ owner, repo }: { owner: string; repo: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [owner, repo]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Couldn&apos;t load insights.
      </div>
    );
  }

  return (
    <div className="space-y-7 p-4">
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          File types · {data.totalFiles} files
        </h3>
        <Donut types={data.fileTypes} />
      </section>

      {data.authors.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Top authors · last {data.totalCommits}
            {data.commitsCapped ? "+" : ""} commits
          </h3>
          <Authors authors={data.authors} />
        </section>
      )}

      {data.activity.length > 1 && (
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Commit activity
          </h3>
          <ActivityBars activity={data.activity} />
        </section>
      )}
    </div>
  );
}

function Donut({ types }: { types: FileType[] }) {
  const total = types.reduce((s, t) => s + t.count, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  // cumulative offset without mutating render-scope state (n is tiny)
  const offsetOf = (i: number) =>
    types.slice(0, i).reduce((s, t) => s + (t.count / total) * C, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 140 140" className="size-40 shrink-0 -rotate-90">
        {types.map((t, i) => {
          const len = (t.count / total) * C;
          return (
            <circle
              key={t.ext}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offsetOf(i)}
              style={{ filter: "drop-shadow(0 0 3px currentColor)", color: PALETTE[i % PALETTE.length] }}
            />
          );
        })}
        <text
          x="70"
          y="70"
          className="rotate-90"
          transform="rotate(90 70 70)"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--foreground)"
          fontSize="15"
          fontWeight="600"
        >
          {types.length}
        </text>
      </svg>
      <ul className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {types.map((t, i) => (
          <li key={t.ext} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="truncate font-mono">.{t.ext}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">{t.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Authors({ authors }: { authors: Author[] }) {
  const max = Math.max(...authors.map((a) => a.count), 1);
  return (
    <ul className="space-y-2">
      {authors.map((a, i) => (
        <li key={a.name} className="flex items-center gap-2.5 text-sm">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: PALETTE[i % PALETTE.length] }}
          >
            {a.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="w-28 shrink-0 truncate">{a.name}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(a.count / max) * 100}%`, background: PALETTE[i % PALETTE.length] }}
            />
          </span>
          <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
            {a.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ActivityBars({ activity }: { activity: Activity[] }) {
  const max = Math.max(...activity.map((a) => a.count), 1);
  const first = activity[0]?.date ?? "";
  const last = activity[activity.length - 1]?.date ?? "";
  return (
    <div>
      <div className="flex h-24 items-end gap-0.5">
        {activity.map((a) => (
          <span
            key={a.date}
            title={`${a.date}: ${a.count}`}
            className="flex-1 rounded-sm bg-primary/70 transition-colors hover:bg-primary"
            style={{ height: `${Math.max(6, (a.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
