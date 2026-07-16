import type { RepoFiles } from "./fetch";
import { buildGraph } from "./graph";

export type KNodeType =
  | "file"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum";
export type KEdgeType = "defines" | "imports" | "inherits" | "calls";

export type KNode = { id: string; label: string; type: KNodeType; file: string };
export type KEdge = { source: string; target: string; type: KEdgeType };
export type Knowledge = {
  nodes: KNode[];
  edges: KEdge[];
  counts: { nodes: Record<string, number>; edges: Record<string, number> };
};

// ponytail: regex symbol extraction, not a type-checked AST. `imports` is
// resolved (reused from the dependency graph); `calls`/`inherits` are name-match
// heuristics — a real call graph needs a language server. Swap for tree-sitter /
// ts-morph when accuracy matters more than zero-setup + all-language coverage.
const MAX_NODES = 3500;
const MAX_CALL_EDGES = 7000;

const base = (p: string) => p.slice(p.lastIndexOf("/") + 1);

type Sym = { name: string; type: KNodeType; parent?: string };

function extractSymbols(file: string, src: string): Sym[] {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  const out: Sym[] = [];
  const add = (name: string, type: KNodeType, parent?: string) => {
    if (name && name.length > 1) out.push({ name, type, parent });
  };
  const m = (re: RegExp, type: KNodeType, pi = 0) => {
    for (const x of src.matchAll(re)) add(x[1], type, pi ? x[pi] : undefined);
  };

  if (/^(mts|cts|tsx|ts|mjs|cjs|jsx|js|vue|svelte)$/.test(ext)) {
    m(/\bfunction\s+([A-Za-z_$][\w$]*)/g, "function");
    m(/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g, "function");
    m(/\bclass\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?/g, "class", 2);
    m(/\binterface\s+([A-Za-z_$][\w$]*)/g, "interface");
    m(/\btype\s+([A-Za-z_$][\w$]*)\s*=/g, "type");
    m(/\benum\s+([A-Za-z_$][\w$]*)/g, "enum");
  } else if (ext === "py" || ext === "pyi") {
    m(/^[ \t]*def\s+([A-Za-z_]\w*)/gm, "function");
    for (const x of src.matchAll(/^[ \t]*class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?/gm))
      add(x[1], "class", (x[2] || "").split(",")[0]?.trim() || undefined);
  } else if (ext === "go") {
    m(/\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/g, "function");
    m(/\btype\s+([A-Za-z_]\w*)\s+struct\b/g, "class");
    m(/\btype\s+([A-Za-z_]\w*)\s+interface\b/g, "interface");
  } else if (ext === "rs") {
    m(/\bfn\s+([A-Za-z_]\w*)/g, "function");
    m(/\bstruct\s+([A-Za-z_]\w*)/g, "class");
    m(/\benum\s+([A-Za-z_]\w*)/g, "enum");
    m(/\btrait\s+([A-Za-z_]\w*)/g, "interface");
  } else if (/^(java|kt|kts|cs|scala)$/.test(ext)) {
    m(/\bclass\s+([A-Za-z_]\w*)(?:\s+extends\s+([A-Za-z_][\w.]*))?/g, "class", 2);
    m(/\binterface\s+([A-Za-z_]\w*)/g, "interface");
    m(/\benum\s+([A-Za-z_]\w*)/g, "enum");
  } else {
    m(/\b(?:function|func|def|fn)\s+([A-Za-z_]\w*)/g, "function");
    m(/\bclass\s+([A-Za-z_]\w*)/g, "class");
  }
  return out;
}

export function buildKnowledge(repo: RepoFiles): Knowledge {
  const graph = buildGraph(repo); // capped file set + resolved import edges
  const files = graph.nodes.map((n) => n.id);
  const fileSet = new Set(files);

  const nodes: KNode[] = [];
  const edges: KEdge[] = [];
  const nodeIds = new Set<string>();
  const byName = new Map<string, string[]>(); // symbol name -> ids
  const classByName = new Map<string, string>(); // for inherits
  const pendingInherit: [string, string][] = [];

  const addNode = (n: KNode) => {
    if (nodeIds.has(n.id) || nodeIds.size >= MAX_NODES) return false;
    nodeIds.add(n.id);
    nodes.push(n);
    return true;
  };

  for (const f of files) addNode({ id: f, label: base(f), type: "file", file: f });

  for (const e of graph.edges)
    edges.push({ source: e.source, target: e.target, type: "imports" });

  for (const f of files) {
    if (nodeIds.size >= MAX_NODES) break;
    const src = repo.files.get(f) ?? "";
    for (const sym of extractSymbols(f, src)) {
      const id = `${f}#${sym.name}`;
      if (!addNode({ id, label: sym.name, type: sym.type, file: f })) continue;
      edges.push({ source: f, target: id, type: "defines" });
      if (!byName.has(sym.name)) byName.set(sym.name, []);
      byName.get(sym.name)!.push(id);
      if (sym.type === "class") classByName.set(sym.name, id);
      if (sym.parent) pendingInherit.push([id, sym.parent.split(".").pop()!]);
    }
  }

  for (const [childId, parentName] of pendingInherit) {
    const parentId = classByName.get(parentName);
    if (parentId) edges.push({ source: childId, target: parentId, type: "inherits" });
  }

  // usage: a file references a uniquely-named symbol defined in ANOTHER file
  let calls = 0;
  for (const f of files) {
    if (calls >= MAX_CALL_EDGES) break;
    const src = repo.files.get(f) ?? "";
    const idents = new Set(src.match(/[A-Za-z_$][\w$]*/g) ?? []);
    for (const name of idents) {
      const ids = byName.get(name);
      if (ids && ids.length === 1 && !ids[0].startsWith(`${f}#`) && fileSet.has(f)) {
        edges.push({ source: f, target: ids[0], type: "calls" });
        if (++calls >= MAX_CALL_EDGES) break;
      }
    }
  }

  const counts = { nodes: {} as Record<string, number>, edges: {} as Record<string, number> };
  for (const n of nodes) counts.nodes[n.type] = (counts.nodes[n.type] ?? 0) + 1;
  for (const e of edges) counts.edges[e.type] = (counts.edges[e.type] ?? 0) + 1;

  return { nodes, edges, counts };
}
