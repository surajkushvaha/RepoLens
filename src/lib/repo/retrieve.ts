// ponytail: lexical retrieval — keyword overlap scoring, path matches weighted
// higher. No embeddings, no vector DB. Good enough to surface the right files
// for a demo; swap for Upstash Vector when semantic recall matters.

export type Hit = { path: string; content: string; score: number };

export function retrieve(
  files: Map<string, string>,
  query: string,
  k = 6,
): Hit[] {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])];
  if (terms.length === 0) return [];

  const hits: Hit[] = [];
  for (const [path, content] of files) {
    const lowerPath = path.toLowerCase();
    const lowerContent = content.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (lowerPath.includes(t)) score += 5;
      score += Math.min(occurrences(lowerContent, t), 10);
    }
    if (score > 0) hits.push({ path, content, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}

function occurrences(haystack: string, needle: string): number {
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

// ---- hybrid context assembly ----------------------------------------------

export type Chunk = {
  path: string;
  text: string;
  startLine?: number;
  endLine?: number;
  related?: boolean; // pulled in via the dependency graph, not direct retrieval
};

export type GraphEdge = { source: string; target: string };

// Files that are almost always the answer to "how do I run / what's the entry
// point / where do I start" — regardless of what the embeddings surface.
const ENTRY_FILE =
  /(^|\/)(main|__main__|index|app|server|cli|manage|run|wsgi|asgi|setup|bin\/\w+)\.(py|ts|tsx|js|jsx|mjs|go|rs|rb|java|kt|php|c|cpp)$|(^|\/)(package\.json|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml|Dockerfile|Makefile|main\.go)$/i;

// Query is asking about how the project is wired, not a specific symbol.
const STRUCTURAL =
  /\b(entry|entrypoint|entry[- ]?point|start(ed|ing|up)?|run|bootstrap|architecture|structure|setup|install|overview|main|how (does|do|to)|where (do|does|to|is|are|should)|what .*(do|does)|get(ting)? started)\b/i;

const isStructural = (q: string) => STRUCTURAL.test(q);

// Blend four signals into one deduped, capped evidence set for the LLM:
//   1. semantic hits from the browser embedding index (highest trust)
//   2. lexical keyword / path matches
//   3. entry-point files, when the question is structural
//   4. GraphRAG — the dependency-graph neighbours of the matched files
//      (what they import + what imports them), so the model sees the connected
//      code around a match, not just the isolated file.
// The union means keyword- and filename-relevant files are never missed just
// because the embeddings ranked docs higher.
export function assembleContext(
  files: Map<string, string>,
  question: string,
  semantic: Chunk[],
  k = 12,
  perFileChars = 2500,
  edges?: GraphEdge[],
): Chunk[] {
  const out: Chunk[] = [];
  const seen = new Set<string>();
  const add = (c: Chunk) => {
    if (seen.has(c.path) || out.length >= k) return;
    seen.add(c.path);
    out.push({ ...c, text: c.text.slice(0, perFileChars) });
  };

  for (const c of semantic) add(c);
  for (const h of retrieve(files, question, 8)) add({ path: h.path, text: h.content });
  if (isStructural(question)) {
    for (const [path, content] of files) {
      if (ENTRY_FILE.test(path)) add({ path, text: content });
    }
  }

  // GraphRAG expansion — beyond the k primary matches, add a few files directly
  // connected to them in the import graph, ranked by how many matches touch them.
  if (edges && edges.length > 0 && out.length > 0) {
    const score = new Map<string, number>();
    for (const e of edges) {
      if (seen.has(e.source) && !seen.has(e.target))
        score.set(e.target, (score.get(e.target) ?? 0) + 1);
      if (seen.has(e.target) && !seen.has(e.source))
        score.set(e.source, (score.get(e.source) ?? 0) + 1);
    }
    const neighbours = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [path] of neighbours) {
      const content = files.get(path);
      if (content && !seen.has(path)) {
        seen.add(path);
        out.push({ path, text: content.slice(0, Math.min(perFileChars, 1500)), related: true });
      }
    }
  }

  return out;
}
