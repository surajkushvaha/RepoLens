"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Boxes, Loader2, Search } from "lucide-react";
import type { Knowledge, KEdgeType, KNodeType } from "@/lib/repo/symbols";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const NODE_COLORS: Record<KNodeType, string> = {
  file: "#60a5fa",
  function: "#34d399",
  class: "#c084fc",
  interface: "#f472b6",
  type: "#fbbf24",
  enum: "#fb7185",
};
const LINK_COLORS: Record<KEdgeType, string> = {
  imports: "#5b6b86",
  defines: "#3a4358",
  inherits: "#c084fc",
  calls: "#22d3ee",
};
const NODE_ORDER: KNodeType[] = ["file", "function", "class", "interface", "type", "enum"];

// append an alpha channel to a hex colour (canvas supports 8-digit hex)
const hexAlpha = (hex: string, a: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0")}`;
const EDGE_ORDER: KEdgeType[] = ["defines", "imports", "calls", "inherits"];

type FGNode = { id: string; label: string; type: KNodeType; file: string };
type FGLink = { source: string; target: string; type: KEdgeType };

export default function KnowledgeGraph({
  data,
  onSelectFile,
  highlight,
}: {
  data: Knowledge;
  onSelectFile?: (path: string, term?: string) => void;
  highlight?: string[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [nodeOff, setNodeOff] = useState<Set<string>>(new Set());
  const [edgeOff, setEdgeOff] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setDims({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const nodes = (data.nodes as FGNode[]).filter((n) => !nodeOff.has(n.type));
    const keep = new Set(nodes.map((n) => n.id));
    const links = (data.edges as FGLink[])
      .filter((e) => !edgeOff.has(e.type) && keep.has(e.source) && keep.has(e.target))
      .map((e) => ({ ...e }));
    // fresh copies (force-graph mutates)
    return { nodes: nodes.map((n) => ({ ...n })), links };
  }, [data, nodeOff, edgeOff]);

  const q = query.trim().toLowerCase();
  const hi = useMemo(() => new Set(highlight ?? []), [highlight]);

  // Is this node "on" (matches the search query, or is in the ask/graph
  // highlight set)? Drives the neon brightening vs dimming.
  const isOn = (n: FGNode) => {
    if (hi.size > 0) return hi.has(n.file);
    if (q) return n.label.toLowerCase().includes(q);
    return true;
  };
  const dimming = hi.size > 0 || q.length > 0;
  // Nodes always keep their type colour — dimming is done via alpha in
  // drawNode, never by overriding the colour itself. With thousands of nodes,
  // recolouring "off" ones to a near-black tone washed out the whole palette
  // (only stray link lines stayed visible); alpha-only dimming keeps every
  // node's colour legible while still making the highlighted set pop.
  const nodeColor = (n: FGNode) => {
    if (dimming && isOn(n)) return "#fde047"; // highlighted -> bright amber
    return NODE_COLORS[n.type] ?? "#9ca3af";
  };

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  // Neon node: a glowing dot (canvas shadowBlur). Highlighted/active nodes glow
  // brighter and larger; dimmed ones fade back.
  const drawNode = (n: FGNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D) => {
    const on = isOn(n);
    const base = n.type === "file" ? 4.5 : 3;
    const r = on && dimming ? base * 1.5 : base;
    const color = nodeColor(n);
    ctx.save();
    ctx.beginPath();
    ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = on ? (dimming ? 18 : 10) : 2;
    ctx.globalAlpha = on || !dimming ? 1 : 0.35;
    ctx.fill();
    ctx.restore();
  };

  const commonProps = {
    graphData,
    width: dims.w,
    height: dims.h,
    backgroundColor: "#0a0a12",
    nodeLabel: (n: FGNode) => `${n.type}: ${n.label}`,
    nodeColor,
    nodeRelSize: 3,
    nodeVal: (n: FGNode) => (n.type === "file" ? 3 : 1),
    nodeCanvasObject: drawNode,
    nodeCanvasObjectMode: () => "replace",
    // dim edges (via alpha, on top of the base colour) whenever a highlight or
    // search is active, so a small "on" set doesn't get swamped by thousands
    // of unrelated calls/imports lines still drawn at full brightness
    linkColor: (l: FGLink) =>
      hexAlpha(LINK_COLORS[l.type] ?? "#475569", dimming ? 0.12 : 0.55),
    linkWidth: (l: FGLink) => (hi.has((l.source as unknown as FGNode)?.file) ? 1.4 : 0.7),
    // flowing neon particles travel along every edge = live animation
    linkDirectionalParticles: 2,
    linkDirectionalParticleWidth: 1.8,
    linkDirectionalParticleSpeed: 0.006,
    linkDirectionalParticleColor: (l: FGLink) => LINK_COLORS[l.type] ?? "#22d3ee",
    cooldownTime: 4000,
    onNodeClick: (n: FGNode) =>
      onSelectFile?.(n.file, n.type === "file" ? undefined : n.label),
  } as const;

  return (
    <div ref={wrapRef} className="relative h-full w-full bg-[#0a0a12]">
      {dims.w > 0 &&
        (mode === "2d" ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <ForceGraph2D {...(commonProps as any)} />
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <ForceGraph3D {...(commonProps as any)} />
        ))}

      {/* filter panel */}
      <div className="absolute left-3 top-3 w-56 rounded-xl border border-white/10 bg-black/50 p-3 text-white backdrop-blur">
        <div className="mb-2 flex items-center gap-2">
          <Boxes className="size-4 text-white/60" />
          <span className="text-sm font-medium">Knowledge graph</span>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search symbols…"
            className="w-full rounded-md border border-white/10 bg-white/5 py-1 pl-7 pr-2 text-xs outline-none placeholder:text-white/30"
          />
        </div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-white/40">
          Nodes
        </p>
        <div className="mb-3 flex flex-wrap gap-1">
          {NODE_ORDER.filter((t) => data.counts.nodes[t]).map((t) => (
            <button
              key={t}
              onClick={() => toggle(nodeOff, setNodeOff, t)}
              style={{ borderColor: NODE_COLORS[t] }}
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                nodeOff.has(t) ? "opacity-30" : ""
              }`}
            >
              <span style={{ color: NODE_COLORS[t] }}>●</span> {t}{" "}
              {data.counts.nodes[t]}
            </button>
          ))}
        </div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-white/40">
          Edges
        </p>
        <div className="flex flex-wrap gap-1">
          {EDGE_ORDER.filter((t) => data.counts.edges[t]).map((t) => (
            <button
              key={t}
              onClick={() => toggle(edgeOff, setEdgeOff, t)}
              className={`rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] ${
                edgeOff.has(t) ? "opacity-30" : ""
              }`}
            >
              {t} {data.counts.edges[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 2D / 3D toggle */}
      <div className="absolute right-3 top-3 flex overflow-hidden rounded-lg border border-white/10 text-xs text-white">
        {(["2d", "3d"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 uppercase ${mode === m ? "bg-white/15" : "bg-black/40 hover:bg-white/10"}`}
          >
            {m}
          </button>
        ))}
      </div>

      {dims.w === 0 && (
        <div className="flex h-full items-center justify-center text-white/50">
          <Loader2 className="animate-spin" />
        </div>
      )}
    </div>
  );
}
