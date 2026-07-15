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
