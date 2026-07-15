"use client";

import { useEffect, useMemo, useRef } from "react";
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

export type GraphData = {
  owner: string;
  repo: string;
  nodes: { id: string; label: string; dir: string }[];
  edges: { source: string; target: string }[];
  externalTop?: string[];
  stats: { files: number; edges: number; external: number; truncated: boolean };
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const NODE_H = 46;
const MIN_W = 130;
const MAX_W = 300;

// A file's "module" = its directory collapsed to 2 levels. Keeps the graph to a
// readable count of nodes (the report's "modules/services", not raw files).
function moduleKey(path: string): string {
  if (!path.includes("/")) return "(root)";
  const dir = path.slice(0, path.lastIndexOf("/"));
  return dir.split("/").slice(0, 2).join("/");
}

type Mod = {
  id: string;
  count: number;
  files: string[];
  accent: string;
};

function clusterAndLayout(data: GraphData) {
  const mods = new Map<string, Mod>();
  const colorByMod = new Map<string, string>();
  const colorFor = (m: string) => {
    if (!colorByMod.has(m))
      colorByMod.set(m, PALETTE[colorByMod.size % PALETTE.length]);
    return colorByMod.get(m)!;
  };

  for (const n of data.nodes) {
    const key = moduleKey(n.id);
    const m = mods.get(key);
    if (!m) {
      mods.set(key, { id: key, count: 1, files: [n.id], accent: colorFor(key) });
    } else {
      m.count++;
      m.files.push(n.id);
    }
  }

  // aggregate edges between modules (skip intra-module), weighted
  const weight = new Map<string, number>();
  for (const e of data.edges) {
    const a = moduleKey(e.source);
    const b = moduleKey(e.target);
    if (a === b) continue;
    weight.set(`${a} ${b}`, (weight.get(`${a} ${b}`) ?? 0) + 1);
  }

  const width = (count: number) =>
    Math.round(Math.min(MAX_W, MIN_W + count * 6));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 160 });
  for (const m of mods.values())
    g.setNode(m.id, { width: width(m.count), height: NODE_H });
  for (const k of weight.keys()) {
    const [a, b] = k.split(" ");
    g.setEdge(a, b);
  }
  dagre.layout(g);

  const moduleList = [...mods.values()].map((m) => {
    const p = g.node(m.id);
    const w = width(m.count);
    return { ...m, x: p.x - w / 2, y: p.y - NODE_H / 2, w };
  });

  const edgeList = [...weight.entries()].map(([k, w]) => {
    const [source, target] = k.split(" ");
    return { source, target, weight: w };
  });

  // entry point = the orchestrator: imports many modules, imported by few
  const outDeg = new Map<string, number>();
  const inDegMod = new Map<string, number>();
  for (const e of edgeList) {
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
    inDegMod.set(e.target, (inDegMod.get(e.target) ?? 0) + 1);
  }
  let entryId = "";
  let best = -Infinity;
  for (const m of mods.values()) {
    const score = (outDeg.get(m.id) ?? 0) * 2 - (inDegMod.get(m.id) ?? 0);
    if (score > best) {
      best = score;
      entryId = m.id;
    }
  }

  return { moduleList, edgeList, entryId };
}

const BASE_STYLE = {
  height: NODE_H,
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 10,
  color: "var(--card-foreground)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "0 12px",
  overflow: "hidden",
  whiteSpace: "nowrap",
} as const;

export default function GraphView({
  data,
  onSelectModule,
  highlight,
}: {
  data: GraphData;
  onSelectModule?: (mod: { id: string; files: string[] }) => void;
  highlight?: string[];
}) {
  const { moduleList, edgeList, entryId } = useMemo(
    () => clusterAndLayout(data),
    [data],
  );

  // click a module -> hand its file list up for drill-down
  const filesOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const mod of moduleList) m.set(mod.id, mod.files);
    return m;
  }, [moduleList]);

  // highlighted files -> their modules
  const hi = useMemo(
    () => new Set((highlight ?? []).map(moduleKey)),
    [highlight],
  );
  const instance = useRef<ReactFlowInstance | null>(null);

  const nodes: Node[] = useMemo(
    () =>
      moduleList.map((m) => {
        const active = hi.size > 0 && hi.has(m.id);
        const dimmed = hi.size > 0 && !hi.has(m.id);
        const isEntry = hi.size === 0 && m.id === entryId;
        return {
          id: m.id,
          position: { x: m.x, y: m.y },
          data: { label: `${isEntry ? "> " : ""}${m.id}  -  ${m.count}` },
          style: {
            ...BASE_STYLE,
            width: m.w,
            background: `color-mix(in oklch, ${m.accent} 12%, var(--card))`,
            border: `1px solid color-mix(in oklch, ${m.accent} 40%, var(--border))`,
            borderLeft: `4px solid ${m.accent}`,
            opacity: dimmed ? 0.25 : 1,
            ...(active && {
              borderColor: m.accent,
              background: `color-mix(in oklch, ${m.accent} 22%, var(--card))`,
              boxShadow: `0 0 0 1px ${m.accent}, 0 0 24px -2px ${m.accent}`,
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
    [moduleList, hi, entryId],
  );

  const edges: Edge[] = useMemo(
    () =>
      edgeList.map((e, i) => {
        const active = hi.size > 0 && hi.has(e.source) && hi.has(e.target);
        const dimmed = hi.size > 0 && !active;
        return {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          animated: active,
          style: {
            stroke: active ? "var(--foreground)" : "var(--muted-foreground)",
            strokeWidth: Math.min(4, 1 + e.weight / 3),
            opacity: dimmed ? 0.06 : active ? 0.9 : 0.25,
          },
        };
      }),
    [edgeList, hi],
  );

  useEffect(() => {
    const flow = instance.current;
    if (!flow) return;
    if (hi.size > 0) {
      flow.fitView({
        nodes: [...hi].map((id) => ({ id })),
        duration: 800,
        padding: 0.35,
      });
    } else if (entryId) {
      // land on the starting point + its immediate neighbours
      const focus = new Set([entryId]);
      for (const e of edgeList) {
        if (e.source === entryId) focus.add(e.target);
        if (e.target === entryId) focus.add(e.source);
      }
      flow.fitView({
        nodes: [...focus].map((id) => ({ id })),
        duration: 700,
        padding: 0.45,
        maxZoom: 1.1,
      });
    } else {
      flow.fitView({ duration: 600 });
    }
  }, [hi, entryId, edgeList]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
      colorMode="system"
      style={{ background: "var(--card)" }}
      onInit={(i) => (instance.current = i)}
      onNodeClick={(_, node) => {
        const files = filesOf.get(node.id);
        if (files) onSelectModule?.({ id: node.id, files });
      }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1.6}
        color="color-mix(in oklch, var(--foreground) 22%, transparent)"
      />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor="#94a3b8" maskColor="rgb(0,0,0,0.05)" />
    </ReactFlow>
  );
}
