"use client";

import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark.css";

const MAX_LINES = 4000;

const LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python", pyi: "python", go: "go", rs: "rust", java: "java",
  kt: "kotlin", kts: "kotlin", scala: "scala", swift: "swift", php: "php",
  rb: "ruby", cs: "csharp", c: "c", h: "c", cc: "cpp", cpp: "cpp", cxx: "cpp",
  hpp: "cpp", json: "json", md: "markdown", css: "css", scss: "scss",
  html: "xml", vue: "xml", yml: "yaml", yaml: "yaml", sh: "bash", bash: "bash",
  lua: "lua", sql: "sql",
};

export function CodeBlock({
  code,
  path,
  highlightLines,
}: {
  code: string;
  path?: string;
  highlightLines?: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const all = code.split("\n");
  const clipped = all.length > MAX_LINES;
  const shown = clipped ? all.slice(0, MAX_LINES).join("\n") : code;

  const ext = (path ?? "").slice((path ?? "").lastIndexOf(".") + 1).toLowerCase();
  const lang = LANG[ext];
  let html: string;
  try {
    html = lang
      ? hljs.highlight(shown, { language: lang, ignoreIllegals: true }).value
      : hljs.highlightAuto(shown).value;
  } catch {
    html = shown.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  }
  // ponytail: naive per-line split of the highlighted HTML. Enables per-line
  // backgrounds + scroll-to; multi-line tokens (block comments, template
  // strings) may lose color at line breaks. Swap for shiki if that bites.
  const lineHtmls = html.split("\n");
  const hl = new Set(highlightLines ?? []);
  const firstHl = highlightLines?.length ? Math.min(...highlightLines) : 0;

  useEffect(() => {
    if (firstHl && ref.current) {
      ref.current
        .querySelector(`[data-line="${firstHl}"]`)
        ?.scrollIntoView({ block: "center" });
    }
  }, [firstHl, path]);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div
        ref={ref}
        className="max-h-[65vh] overflow-auto bg-[#0d1117] font-mono text-xs leading-[20px]"
      >
        <div className="w-max min-w-full py-2">
          {lineHtmls.map((lh, i) => {
            const n = i + 1;
            const on = hl.has(n);
            return (
              <div
                key={i}
                data-line={n}
                className={`flex ${on ? "bg-yellow-400/[0.13]" : ""}`}
              >
                <span className="sticky left-0 w-12 shrink-0 select-none border-r border-white/10 bg-[#0d1117] px-2 text-right text-white/30">
                  {n}
                </span>
                <code
                  className="hljs flex-1 whitespace-pre px-3"
                  style={{ background: "transparent" }}
                  dangerouslySetInnerHTML={{ __html: lh || " " }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {clipped && (
        <div className="bg-[#0d1117] px-3 py-2 text-white/40">
          … {all.length - MAX_LINES} more lines truncated
        </div>
      )}
    </div>
  );
}
