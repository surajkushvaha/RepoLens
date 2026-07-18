"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { moduleColor } from "@/lib/colors";

export type GraphData = {
  owner: string;
  repo: string;
  nodes: { id: string; label: string; dir: string }[];
  edges: { source: string; target: string }[];
  externalTop?: string[];
  stats: { files: number; edges: number; external: number; truncated: boolean };
};

const NODE_H = 46;
const FILE_H = 30;
const MIN_W = 130;
const MAX_W = 300;

function moduleKey(path: string): string {
  if (!path.includes("/")) return "(root)";
  return path.slice(0, path.lastIndexOf("/")).split("/").slice(0, 2).join("/");
}
const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const modW = (c: number) => Math.round(Math.min(MAX_W, MIN_W + c * 6));
const fileW = (name: string) => Math.round(Math.min(240, 90 + name.length * 6.5));

type LNode = {
  id: string;
  kind: "module" | "file";
  label: string;
  module: string;
  files?: string[];
  count?: number;
  accent: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// Build the node/edge set for the current expansion state: expanded modules
// render their files; the rest stay collapsed. Edges remap to whichever
// endpoint (file or module) is currently visible.
function buildView(data: GraphData, expanded: Set<string>) {
  const moduleFiles = new Map<string, string[]>();
  for (const n of data.nodes) {
    const m = moduleKey(n.id);
    if (!moduleFiles.has(m)) moduleFiles.set(m, []);
    moduleFiles.get(m)!.push(n.id);
  }
  const endpoint = (f: string) => {
    const m = moduleKey(f);
    return expanded.has(m) ? f : m;
  };

  const weight = new Map<string, number>();
  for (const e of data.edges) {
    const a = endpoint(e.source);
    const b = endpoint(e.target);
    if (a === b) continue;
    weight.set(`${a}\t${b}`, (weight.get(`${a}\t${b}`) ?? 0) + 1);
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 26, ranksep: 130 });
  const meta = new Map<string, { kind: "module" | "file"; w: number; h: number }>();
  for (const [m, files] of moduleFiles) {
    if (expanded.has(m)) {
      for (const f of files) {
        const w = fileW(basename(f));
        g.setNode(f, { width: w, height: FILE_H });
        meta.set(f, { kind: "file", w, h: FILE_H });
      }
    } else {
      const w = modW(files.length);
      g.setNode(m, { width: w, height: NODE_H });
      meta.set(m, { kind: "module", w, h: NODE_H });
    }
  }
  for (const k of weight.keys()) {
    const [a, b] = k.split("\t");
    if (g.hasNode(a) && g.hasNode(b)) g.setEdge(a, b);
  }
  dagre.layout(g);

  const nodes: LNode[] = [];
  for (const [id, mt] of meta) {
    const p = g.node(id);
    if (mt.kind === "module") {
      nodes.push({
        id,
        kind: "module",
        label: id,
        module: id,
        files: moduleFiles.get(id)!,
        count: moduleFiles.get(id)!.length,
        accent: moduleColor(id),
        x: p.x - mt.w / 2,
        y: p.y - mt.h / 2,
        w: mt.w,
        h: mt.h,
      });
    } else {
      const m = moduleKey(id);
      nodes.push({
        id,
        kind: "file",
        label: basename(id),
        module: m,
        accent: moduleColor(m),
        x: p.x - mt.w / 2,
        y: p.y - mt.h / 2,
        w: mt.w,
        h: mt.h,
      });
    }
  }
  const edges = [...weight.entries()]
    .filter(([k]) => {
      const [a, b] = k.split("\t");
      return meta.has(a) && meta.has(b);
    })
    .map(([k, w]) => {
      const [source, target] = k.split("\t");
      return { source, target, weight: w };
    });

  // entry point at the module level (orchestrator: many out, few in)
  const out = new Map<string, number>();
  const inn = new Map<string, number>();
  const seen = new Set<string>();
  for (const e of data.edges) {
    const a = moduleKey(e.source);
    const b = moduleKey(e.target);
    if (a === b) continue;
    const k = `${a}\t${b}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.set(a, (out.get(a) ?? 0) + 1);
    inn.set(b, (inn.get(b) ?? 0) + 1);
  }
  let entryId = "";
  let best = -Infinity;
  for (const m of moduleFiles.keys()) {
    const s = (out.get(m) ?? 0) * 2 - (inn.get(m) ?? 0);
    if (s > best) {
      best = s;
      entryId = m;
    }
  }

  return { nodes, edges, entryId };
}

const BASE = {
  fontWeight: 600,
  borderRadius: 10,
  color: "var(--card-foreground)",
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
  overflow: "hidden",
  whiteSpace: "nowrap",
} as const;

export default function GraphView({
  data,
  onSelectModule,
  onSelectFile,
  highlight,
}: {
  data: GraphData;
  onSelectModule?: (mod: { id: string; files: string[] }) => void;
  onSelectFile?: (path: string) => void;
  highlight?: string[];
}) {
  const { resolvedTheme } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusMod, setFocusMod] = useState<string | null>(null);
  useEffect(() => {
    setExpanded(new Set());
    setFocusMod(null);
  }, [data]);

  const view = useMemo(() => buildView(data, expanded), [data, expanded]);
  const { entryId } = view;
  const instance = useRef<ReactFlowInstance | null>(null);

  // Ask ↔ graph sync: when a Q&A / search highlights files, auto-expand the
  // modules that contain them so the exact files light up (not just their
  // collapsed module).
  useEffect(() => {
    if (!highlight || highlight.length === 0) return;
    const mods = highlight.filter((h) => h.includes("/")).map(moduleKey);
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const m of mods) if (!next.has(m)) { next.add(m); changed = true; }
      return changed ? next : prev;
    });
  }, [highlight]);

  const hiFiles = useMemo(() => new Set(highlight ?? []), [highlight]);
  const hiMods = useMemo(
    () => new Set((highlight ?? []).map(moduleKey)),
    [highlight],
  );
  const isHi = (n: LNode) =>
    n.kind === "file" ? hiFiles.has(n.id) : hiMods.has(n.id);

  const nodes: Node[] = useMemo(
    () =>
      view.nodes.map((n) => {
        const on = hiFiles.size > 0 && isHi(n);
        const dim = hiFiles.size > 0 && !isHi(n);
        const isEntry = hiFiles.size === 0 && n.kind === "module" && n.id === entryId;
        const isFile = n.kind === "file";
        return {
          id: n.id,
          position: { x: n.x, y: n.y },
          className: on ? "repolens-node-hi" : isEntry ? "repolens-node-entry" : undefined,
          data: {
            label: `${isEntry ? "★ " : ""}${isFile ? n.label : `${n.id}  ·  ${n.count}`}`,
          },
          style: {
            ...BASE,
            width: n.w,
            height: n.h,
            fontSize: isFile ? 11 : 12,
            fontFamily: isFile ? "var(--font-mono)" : undefined,
            background: `color-mix(in oklch, ${n.accent} ${isFile ? 8 : 12}%, var(--card))`,
            border: `1px solid color-mix(in oklch, ${n.accent} 40%, var(--border))`,
            borderLeft: `${isFile ? 3 : 4}px solid ${n.accent}`,
            opacity: dim ? 0.25 : 1,
            // soft neon glow on every node; on/entry states override below
            boxShadow: `0 0 12px -6px ${n.accent}`,
            ...(on && {
              borderColor: n.accent,
              background: `color-mix(in oklch, ${n.accent} 22%, var(--card))`,
              boxShadow: `0 0 0 1px ${n.accent}, 0 0 22px -2px ${n.accent}`,
            }),
            ...(isEntry && {
              borderColor: "var(--primary)",
              boxShadow:
                "0 0 0 2px var(--primary), 0 0 26px -2px color-mix(in oklch, var(--primary) 70%, transparent)",
            }),
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };
      }),
    [view.nodes, hiFiles, hiMods, entryId],
  );

  const edges: Edge[] = useMemo(
    () =>
      view.edges.map((e, i) => {
        const on =
          hiFiles.size > 0 &&
          (hiFiles.has(e.source) || hiMods.has(e.source)) &&
          (hiFiles.has(e.target) || hiMods.has(e.target));
        const dim = hiFiles.size > 0 && !on;
        // colour each edge by its source module for a neon, artistic look;
        // active/highlighted edges switch to the primary and glow brighter.
        // `color` matches `stroke` so the CSS drop-shadow (currentColor) glows.
        const col = on ? "var(--primary)" : moduleColor(moduleKey(e.source));
        return {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          type: "bezier",
          animated: on,
          style: {
            stroke: col,
            color: col,
            strokeWidth: on ? Math.min(4, 1.5 + e.weight / 3) : Math.min(3, 1 + e.weight / 3),
            opacity: dim ? 0.06 : on ? 0.95 : 0.4,
          },
        };
      }),
    [view.edges, hiFiles, hiMods],
  );

  // camera: highlighted subset, else center the (collapsed) entry point
  useEffect(() => {
    const flow = instance.current;
    if (!flow) return;
    if (hiFiles.size > 0) {
      const focus = [...hiFiles].map((f) =>
        expanded.has(moduleKey(f)) ? f : moduleKey(f),
      );
      flow.fitView({
        nodes: [...new Set(focus)].map((id) => ({ id })),
        duration: 700,
        padding: 0.35,
      });
    } else if (focusMod) {
      // just expanded a module -> frame its files
      const ids = view.nodes.filter((n) => n.module === focusMod).map((n) => ({
        id: n.id,
      }));
      if (ids.length) flow.fitView({ nodes: ids, duration: 700, padding: 0.3 });
    } else {
      const m = view.nodes.find((n) => n.id === entryId && n.kind === "module");
      if (m) {
        flow.setCenter(m.x + m.w / 2, m.y + m.h / 2, { zoom: 0.75, duration: 700 });
      } else {
        flow.fitView({ duration: 500 });
      }
    }
  }, [hiFiles, entryId, view.nodes, expanded, focusMod]);

  const nodeMeta = useMemo(() => {
    const m = new Map<string, LNode>();
    for (const n of view.nodes) m.set(n.id, n);
    return m;
  }, [view.nodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      minZoom={0.05}
      proOptions={{ hideAttribution: true }}
      colorMode={resolvedTheme === "dark" ? "dark" : "light"}
      className="repolens-graph"
      style={{ background: "var(--card)" }}
      onInit={(i) => (instance.current = i)}
      onNodeClick={(_, node) => {
        const n = nodeMeta.get(node.id);
        if (!n) return;
        if (n.kind === "module") onSelectModule?.({ id: n.id, files: n.files ?? [] });
        else onSelectFile?.(n.id);
      }}
      onNodeDoubleClick={(_, node) => {
        const n = nodeMeta.get(node.id);
        if (!n) return;
        setExpanded((prev) => {
          const next = new Set(prev);
          if (n.kind === "module") {
            next.add(n.id);
            setFocusMod(n.id);
          } else {
            next.delete(n.module); // double-click a file collapses its module
            setFocusMod(null);
          }
          return next;
        });
      }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1.6}
        color="color-mix(in oklch, var(--foreground) 22%, transparent)"
      />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeStrokeWidth={3}
        nodeBorderRadius={4}
        nodeColor={(n) => {
          const colors = ["#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];
          let h = 0;
          for (const c of n.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
          return colors[h % colors.length];
        }}
        maskColor="rgba(100,116,139,0.12)"
      />
    </ReactFlow>
  );
}
