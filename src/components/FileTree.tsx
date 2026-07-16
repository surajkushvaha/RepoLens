"use client";

import { useState } from "react";
import { ChevronRight, Folder } from "lucide-react";
import { folderModule, moduleColor } from "@/lib/colors";
import { FileIcon } from "@/components/fileIcon";

type TreeNode = {
  name: string;
  path: string;
  isFile: boolean;
  children: Map<string, TreeNode>;
};

function build(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isFile: false, children: new Map() };
  for (const p of paths) {
    const parts = p.split("/");
    let cur = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      let child = cur.children.get(part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isFile,
          children: new Map(),
        };
        cur.children.set(part, child);
      }
      cur = child;
    });
  }
  return root;
}

function filesUnder(node: TreeNode): string[] {
  if (node.isFile) return [node.path];
  const out: string[] = [];
  for (const c of node.children.values()) out.push(...filesUnder(c));
  return out;
}

function sortedKids(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1; // folders first
    return a.name.localeCompare(b.name);
  });
}

function Row({
  node,
  depth,
  onOpenFile,
  onHighlight,
}: {
  node: TreeNode;
  depth: number;
  onOpenFile: (path: string) => void;
  onHighlight: (files: string[]) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const pad = { paddingLeft: 8 + depth * 14 };

  if (node.isFile) {
    return (
      <button
        onClick={() => onOpenFile(node.path)}
        style={pad}
        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <FileIcon path={node.path} className="size-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  // same color as this folder's graph module node
  const color = moduleColor(folderModule(node.path));
  const kids = sortedKids(node);
  const count = filesUnder(node).length;

  return (
    <>
      <button
        onClick={() => {
          setOpen((v) => !v);
          onHighlight(filesUnder(node));
        }}
        style={pad}
        className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-xs hover:bg-muted"
      >
        <ChevronRight
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Folder
          className="size-3.5 shrink-0"
          style={{ color, fill: color }}
        />
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto pl-2 font-mono text-[10px] text-muted-foreground/60">
          {count}
        </span>
      </button>
      {open &&
        kids.map((k) => (
          <Row
            key={k.path}
            node={k}
            depth={depth + 1}
            onOpenFile={onOpenFile}
            onHighlight={onHighlight}
          />
        ))}
    </>
  );
}

export function FileTree({
  files,
  onOpenFile,
  onHighlight,
}: {
  files: string[];
  onOpenFile: (path: string) => void;
  onHighlight: (files: string[]) => void;
}) {
  const root = build(files);
  return (
    <div className="flex flex-col">
      {sortedKids(root).map((k) => (
        <Row
          key={k.path}
          node={k}
          depth={0}
          onOpenFile={onOpenFile}
          onHighlight={onHighlight}
        />
      ))}
    </div>
  );
}
