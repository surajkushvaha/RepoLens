import { FileCode2, FileJson, FileText, FileType } from "lucide-react";

// language brand-ish colors, so a file's type reads at a glance
const COLORS: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  mts: "#3178c6",
  cts: "#3178c6",
  js: "#eab308",
  jsx: "#eab308",
  mjs: "#eab308",
  cjs: "#eab308",
  py: "#3572A5",
  pyi: "#3572A5",
  go: "#00ADD8",
  rs: "#dea584",
  java: "#b07219",
  kt: "#a97bff",
  kts: "#a97bff",
  scala: "#c22d40",
  swift: "#F05138",
  php: "#4F5D95",
  rb: "#e0115f",
  cs: "#178600",
  c: "#8b8b8b",
  h: "#8b8b8b",
  cc: "#f34b7d",
  cpp: "#f34b7d",
  cxx: "#f34b7d",
  hpp: "#f34b7d",
  vue: "#41b883",
  svelte: "#ff3e00",
  astro: "#ff5d01",
  dart: "#00B4AB",
  lua: "#000080",
  json: "#cbcb41",
  md: "#519aba",
  css: "#563d7c",
  scss: "#c6538c",
  html: "#e34c26",
};

export function FileIcon({
  path,
  className = "",
}: {
  path: string;
  className?: string;
}) {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const color = COLORS[ext] ?? "var(--muted-foreground)";
  const Icon =
    ext === "json"
      ? FileJson
      : ext === "md" || ext === "txt"
        ? FileText
        : ext === "css" || ext === "scss" || ext === "html"
          ? FileType
          : FileCode2;
  return <Icon className={className} style={{ color }} />;
}
