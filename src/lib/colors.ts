// Shared so a graph module node and its folder in the tree get the SAME color.
export const NODE_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function moduleColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return NODE_PALETTE[h % NODE_PALETTE.length];
}

// a folder path -> the graph module it belongs to (dir collapsed to 2 levels)
export function folderModule(path: string): string {
  return path.split("/").slice(0, 2).join("/");
}
