"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronLeft,
  Copy,
  Cpu,
  Download,
  FileCode2,
  FileText,
  FolderGit2,
  FolderOpen,
  FolderTree,
  Layers,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeBlock } from "@/components/CodeBlock";
import { FileTree } from "@/components/FileTree";
import { FileIcon } from "@/components/fileIcon";
import { Markdown } from "@/components/Markdown";
import { ThemeToggle } from "@/components/theme";
import type { GraphData } from "@/components/GraphView";
import type { Knowledge } from "@/lib/repo/symbols";
import {
  buildIndex,
  hasIndex,
  search as semanticSearchApi,
  type SemanticHit,
  type BuildProgress,
} from "@/lib/embeddings/client";
import { Landing } from "@/components/Landing";
import { useAuth, useClerk, UserButton } from "@clerk/nextjs";

type Module = { id: string; files: string[] };
type View =
  | { kind: "module"; mod: Module }
  | { kind: "file"; path: string; back?: Module }
  | { kind: "qa"; question: string }
  | { kind: "search"; query: string; results: SearchHit[] }
  | { kind: "semantic"; query: string; results: SemanticHit[] }
  | null;

type SearchHit = { path: string; lines: number[]; count: number };

const STOP = new Set([
  "how", "does", "the", "where", "this", "that", "used", "use", "work",
  "works", "are", "for", "and", "with", "what", "when", "which", "from",
  "into", "have", "its", "was", "get", "set", "you", "can", "all",
]);

// keywords worth highlighting from a natural-language query
function queryTerms(q: string): string[] {
  return [
    ...new Set(
      (q.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []).filter((w) => !STOP.has(w)),
    ),
  ];
}

// 1-indexed line numbers in `code` that contain any term
function matchLines(code: string, terms: string[]): number[] {
  const t = terms.map((s) => s.toLowerCase()).filter((s) => s.length >= 3);
  if (!t.length) return [];
  const out: number[] = [];
  code.split("\n").forEach((line, i) => {
    const l = line.toLowerCase();
    if (t.some((term) => l.includes(term))) out.push(i + 1);
  });
  return out;
}

const GraphView = dynamic(() => import("@/components/GraphView"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <Loader2 className="animate-spin" />
    </div>
  ),
});

const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[#0a0a12] text-white/50">
      <Loader2 className="animate-spin" />
    </div>
  ),
});

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [view, setView] = useState<View>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeHl, setCodeHl] = useState<number[]>([]);
  const [codeLoading, setCodeLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState<string[]>([]);

  // auth via Clerk — hosted, no DB or extra keys to juggle
  const { isSignedIn } = useAuth();
  const clerk = useClerk();

  // client-side embedding index — semantic search runs entirely in the browser
  const [indexStatus, setIndexStatus] = useState<
    "idle" | "building" | "ready" | "error"
  >("idle");
  const [indexMsg, setIndexMsg] = useState("");
  const [semanticBusy, setSemanticBusy] = useState(false);

  // Fetch the repo's source once and build (or reuse) its in-browser vector
  // index. Nothing leaves the device; embeddings + storage are all client-side.
  async function buildRepoIndex(owner: string, repo: string) {
    try {
      if (await hasIndex(owner, repo)) {
        setIndexStatus("ready");
        setIndexMsg("");
        return;
      }
      setIndexStatus("building");
      setIndexMsg("loading source…");
      const res = await fetch("/api/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load source");

      await buildIndex(owner, repo, data.files, (p: BuildProgress) => {
        if (p.phase === "model")
          setIndexMsg(
            p.total
              ? `downloading model ${Math.round(((p.loaded ?? 0) / p.total) * 100)}%`
              : "loading model…",
          );
        else if (p.phase === "embed")
          setIndexMsg(`embedding ${p.done}/${p.total}`);
        else if (p.phase === "save") setIndexMsg("saving index…");
      });
      setIndexStatus("ready");
      setIndexMsg("");
    } catch (err) {
      setIndexStatus("error");
      setIndexMsg(err instanceof Error ? err.message : "Indexing failed");
    }
  }

  // Semantic search over the in-browser vector index (cosine similarity).
  async function semanticSearch() {
    if (!graph || !question.trim()) return;
    if (indexStatus !== "ready") {
      toast(
        indexStatus === "building"
          ? "Still building the search index — one moment."
          : "Semantic index unavailable for this repo.",
      );
      return;
    }
    const q = question.trim();
    setView({ kind: "semantic", query: q, results: [] });
    setSemanticBusy(true);
    try {
      const results = await semanticSearchApi(graph.owner, graph.repo, q);
      setView({ kind: "semantic", query: q, results });
      setHighlight(results.map((r) => r.path));
    } catch {
      toast("Semantic search failed.");
      setView(null);
    } finally {
      setSemanticBusy(false);
    }
  }

  // literal code search / find-usages over the whole repo
  async function findInCode() {
    if (!graph || !question.trim()) return;
    const q = question.trim();
    setView({ kind: "search", query: q, results: [] });
    setSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: graph.owner, repo: graph.repo, query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Search failed");
        setView(null);
        return;
      }
      const results: SearchHit[] = data.results ?? [];
      setView({ kind: "search", query: q, results });
      setHighlight(results.map((r) => r.path));
    } catch {
      toast("Network error — could not reach the server.");
    } finally {
      setSearching(false);
    }
  }
  const [overview, setOverview] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [leftPanel, setLeftPanel] = useState<"overview" | "directory" | null>(
    null,
  );
  const [statsModal, setStatsModal] = useState<
    "files" | "imports" | "external" | null
  >(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<"structure" | "knowledge">("structure");
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  async function showKnowledge() {
    if (!graph) return;
    setGraphMode("knowledge");
    setLeftPanel(null); // free the left space for the graph's filter panel
    if (knowledge || knowledgeLoading) return;
    setKnowledgeLoading(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: graph.owner, repo: graph.repo }),
      });
      const data = await res.json();
      if (res.ok) setKnowledge(data);
      else {
        toast(data.error ?? "Failed to build knowledge graph");
        setGraphMode("structure");
      }
    } catch {
      toast("Network error — could not reach the server.");
      setGraphMode("structure");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function generateReadme() {
    if (!graph) return;
    setReadmeOpen(true);
    if (readme || readmeLoading) return; // reuse once generated
    setReadmeLoading(true);
    try {
      const res = await fetch("/api/readme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: graph.owner, repo: graph.repo }),
      });
      const data = await res.json();
      if (res.ok) setReadme(data.markdown);
      else {
        toast(data.error ?? "Failed to generate README");
        setReadmeOpen(false);
      }
    } catch {
      toast("Network error — could not reach the server.");
      setReadmeOpen(false);
    } finally {
      setReadmeLoading(false);
    }
  }

  function downloadReadme() {
    if (!readme) return;
    const url = URL.createObjectURL(
      new Blob([readme], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generateOverview(owner: string, repo: string) {
    setOverview(null);
    setOverviewLoading(true);
    try {
      const res = await fetch("/api/architecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const data = await res.json();
      setOverview(res.ok ? data.overview : (data.error ?? "Failed to summarize"));
    } catch {
      setOverview("Network error — could not reach the server.");
    } finally {
      setOverviewLoading(false);
    }
  }

  function closePanel() {
    setView(null);
    setHighlight([]);
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!graph || !question.trim()) return;
    const q = question.trim();
    setView({ kind: "qa", question: q });
    setQaAnswer(null);
    setHighlight([]);
    setAsking(true);
    try {
      // Retrieve the most relevant chunks with the in-browser embedding index and
      // send them along as evidence, so the model answers from the right code.
      // Falls back to server-side retrieval if the index isn't ready.
      let context:
        | { path: string; text: string; startLine: number; endLine: number }[]
        | undefined;
      if (indexStatus === "ready") {
        try {
          const hits = await semanticSearchApi(graph.owner, graph.repo, q, 10);
          if (hits.length) {
            context = hits.map((h) => ({
              path: h.path,
              text: h.text,
              startLine: h.startLine,
              endLine: h.endLine,
            }));
            setHighlight(hits.map((h) => h.path)); // highlight instantly
          }
        } catch {
          /* semantic index unavailable — server will retrieve instead */
        }
      }
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: graph.owner,
          repo: graph.repo,
          question: q,
          context,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setQaAnswer(data.error ?? "Failed to answer");
        return;
      }
      // relevant files come back in a header -> highlight the graph immediately
      const files = JSON.parse(res.headers.get("x-repolens-files") ?? "[]");
      setHighlight(files);
      // stream the answer token-by-token
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      setQaAnswer(""); // switch skeleton -> streaming text
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setQaAnswer(acc);
      }
    } catch {
      setQaAnswer("Network error — could not reach the server.");
    } finally {
      setAsking(false);
    }
  }

  // drill into a file: show its source (fast, from cache) and its AI summary (async).
  // `terms` highlights the lines where those keywords appear (search / find-usages).
  function openFile(path: string, back?: Module, terms: string[] = []) {
    if (!graph) return;
    setView({ kind: "file", path, back });
    setCode(null);
    setCodeHl([]);
    setSummary(null);
    setCodeLoading(true);
    setSummaryLoading(true);
    const body = JSON.stringify({ owner: graph.owner, repo: graph.repo, path });
    const headers = { "Content-Type": "application/json" };
    fetch("/api/file", { method: "POST", headers, body })
      .then((r) => r.json())
      .then((d) => {
        const c = d.code ?? `// ${d.error ?? "empty"}`;
        setCode(c);
        setCodeHl(matchLines(c, terms));
      })
      .catch(() => setCode("// Failed to load file"))
      .finally(() => setCodeLoading(false));
    fetch("/api/summarize", { method: "POST", headers, body })
      .then((r) => r.json())
      .then((d) => setSummary(d.summary ?? d.error ?? "Failed to summarize"))
      .catch(() => setSummary("Failed to summarize"))
      .finally(() => setSummaryLoading(false));
  }

  // open a file's code AND highlight/zoom its module in the graph
  function openFileHighlight(path: string) {
    setHighlight([path]);
    openFile(path);
    setStatsModal(null);
  }

  function analyze(e: React.FormEvent) {
    e.preventDefault();
    void runAnalyze(url);
  }

  // pick a repo from history: fill the input and analyze it
  function analyzeUrl(target: string) {
    setUrl(target);
    void runAnalyze(target);
  }

  async function runAnalyze(target: string) {
    // gate: only authenticated users proceed into the analyzer
    if (!isSignedIn) {
      clerk.openSignIn();
      return;
    }
    if (!target.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Something went wrong");
        return;
      }
      const g = data as GraphData;
      setGraph(g);
      setReadme(null);
      setKnowledge(null);
      setGraphMode("structure");
      setLeftPanel("overview");
      generateOverview(g.owner, g.repo);
      setIndexStatus("idle");
      buildRepoIndex(g.owner, g.repo); // background: client-side embeddings
    } catch {
      toast("Network error", { description: "Could not reach the server." });
    } finally {
      setLoading(false);
    }
  }

  if (graph) {
    const s = graph.stats;
    const leftInset = leftPanel ? (leftPanel === "directory" ? 340 : 380) : 0;
    const rightInset = view ? (view.kind === "file" ? 680 : 380) : 0;
    return (
      <div className="fixed inset-0 flex flex-col">
        <header className="flex items-center gap-4 border-b px-4 py-2.5">
          <FolderGit2 className="size-4 text-muted-foreground" />
          <span className="font-mono text-sm">
            {graph.owner}/{graph.repo}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <button
              onClick={() => setStatsModal("files")}
              className="hover:text-foreground hover:underline"
            >
              {s.files} files
            </button>
            <span>·</span>
            <button
              onClick={() => setStatsModal("imports")}
              className="hover:text-foreground hover:underline"
            >
              {s.edges} imports
            </button>
            <span>·</span>
            <button
              onClick={() => setStatsModal("external")}
              className="hover:text-foreground hover:underline"
            >
              {s.external} external
            </button>
            {s.truncated && <span>· truncated</span>}
          </div>
          <div className="ml-3 flex overflow-hidden rounded-md border text-xs">
            <button
              onClick={() => setGraphMode("structure")}
              className={`px-2.5 py-1 ${graphMode === "structure" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Structure
            </button>
            <button
              onClick={showKnowledge}
              className={`border-l px-2.5 py-1 ${graphMode === "knowledge" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Knowledge
            </button>
          </div>
          {indexStatus !== "idle" && (
            <span
              className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground"
              title={
                indexStatus === "ready"
                  ? "Semantic index ready — search runs in your browser"
                  : indexMsg
              }
            >
              <Cpu
                className={`size-3 ${indexStatus === "building" ? "animate-pulse" : indexStatus === "ready" ? "text-primary" : "text-destructive"}`}
              />
              {indexStatus === "ready"
                ? "semantic ready"
                : indexStatus === "error"
                  ? "index failed"
                  : indexMsg || "indexing…"}
            </span>
          )}
          <Button
            variant={leftPanel === "overview" ? "secondary" : "ghost"}
            size="sm"
            className="ml-auto"
            onClick={() =>
              setLeftPanel((p) => (p === "overview" ? null : "overview"))
            }
          >
            <Layers /> Overview
          </Button>
          <Button
            variant={leftPanel === "directory" ? "secondary" : "ghost"}
            size="sm"
            onClick={() =>
              setLeftPanel((p) => (p === "directory" ? null : "directory"))
            }
          >
            <FolderTree /> Files
          </Button>
          <Button variant="ghost" size="sm" onClick={generateReadme}>
            <FileText /> README
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setGraph(null)}>
            <X /> New
          </Button>
          <ThemeToggle className="ml-1" />
          <UserButton />
        </header>
        <div className="relative flex flex-1">
          {graphMode === "structure" ? (
            <>
              <GraphView
                data={graph}
                onSelectModule={(mod) => setView({ kind: "module", mod })}
                onSelectFile={(p) => openFile(p)}
                highlight={highlight}
              />
              <p className="pointer-events-none absolute left-1/2 top-3 z-[5] -translate-x-1/2 rounded-full border bg-background/70 px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur">
                click a module to inspect · double-click to expand into files
              </p>
            </>
          ) : knowledgeLoading || !knowledge ? (
            <div className="flex flex-1 items-center justify-center bg-[#0a0a12] text-white/50">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <KnowledgeGraph
              data={knowledge}
              onSelectFile={(p, term) => openFile(p, undefined, term ? [term] : [])}
            />
          )}

          {/* Directory tree (left) */}
          {leftPanel === "directory" && (
            <aside className="absolute left-0 top-0 z-10 flex h-full w-[340px] max-w-[85vw] flex-col border-r bg-background/95 backdrop-blur">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <FolderTree className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">Files</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setLeftPanel(null)}
                >
                  <X />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                <FileTree
                  files={graph.nodes.map((n) => n.id)}
                  onOpenFile={openFileHighlight}
                  onHighlight={setHighlight}
                />
              </div>
            </aside>
          )}

          {/* Architecture overview (left) */}
          {leftPanel === "overview" && (
            <aside className="absolute left-0 top-0 z-10 flex h-full w-[380px] max-w-[85vw] flex-col border-r bg-background/95 backdrop-blur">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Layers className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">Architecture</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setLeftPanel(null)}
                >
                  <X />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {overviewLoading ? (
                  <div className="space-y-2.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-[95%]" />
                    <Skeleton className="h-3.5 w-[85%]" />
                    <Skeleton className="h-3.5 w-[92%]" />
                    <Skeleton className="h-3.5 w-[70%]" />
                  </div>
                ) : (
                  <Markdown>{overview ?? ""}</Markdown>
                )}
                {graph.externalTop && graph.externalTop.length > 0 && (
                  <div className="mt-5 border-t pt-4">
                    <p className="mb-2 font-mono text-xs text-muted-foreground">
                      tech stack
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {graph.externalTop.slice(0, 12).map((p) => (
                        <span
                          key={p}
                          className="rounded-md border px-2 py-0.5 font-mono text-xs text-muted-foreground"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Ask bar — recenters in the visible gap, stays above side panels */}
          <form
            onSubmit={ask}
            style={{ left: leftInset, right: rightInset }}
            className="absolute bottom-5 z-[15] mx-auto flex w-[min(560px,calc(100%-2rem))] items-center gap-2 rounded-xl border bg-background/90 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur"
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask AI, or Find a symbol in the code…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={searching}
              onClick={findInCode}
              title="Find in code (literal usages)"
            >
              {searching ? <Loader2 className="animate-spin" /> : "Find"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={semanticBusy || indexStatus === "building"}
              onClick={semanticSearch}
              title={
                indexStatus === "ready"
                  ? "Semantic search (in-browser embeddings)"
                  : indexStatus === "building"
                    ? `Building index… ${indexMsg}`
                    : indexStatus === "error"
                      ? `Index error: ${indexMsg}`
                      : "Preparing semantic index…"
              }
            >
              {semanticBusy || indexStatus === "building" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Cpu className="size-4" />
              )}
            </Button>
            <Button type="submit" size="sm" disabled={asking}>
              {asking ? <Loader2 className="animate-spin" /> : "Ask"}
            </Button>
          </form>

          {view && (
            <aside
              className={`absolute right-0 top-0 z-10 flex h-full max-w-[92vw] flex-col border-l bg-background/95 backdrop-blur ${
                view.kind === "file" ? "w-[680px]" : "w-[380px]"
              }`}
            >
              {/* header */}
              <div className="flex items-center gap-2 border-b px-4 py-3">
                {view.kind === "file" && view.back && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setView({ kind: "module", mod: view.back! })}
                  >
                    <ChevronLeft />
                  </Button>
                )}
                {view.kind === "module" && (
                  <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                )}
                {view.kind === "file" && (
                  <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
                )}
                {view.kind === "qa" && (
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                {view.kind === "search" && (
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                )}
                {view.kind === "semantic" && (
                  <Cpu className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={`flex-1 break-all leading-relaxed ${
                    view.kind === "qa"
                      ? "text-sm font-medium"
                      : "font-mono text-xs"
                  }`}
                >
                  {view.kind === "module"
                    ? `${view.mod.id}  ·  ${view.mod.files.length} files`
                    : view.kind === "file"
                      ? view.path
                      : view.kind === "search"
                        ? `“${view.query}”`
                        : view.kind === "semantic"
                          ? `semantic · “${view.query}”`
                          : view.question}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={closePanel}>
                  <X />
                </Button>
              </div>

              {/* body */}
              <div className="flex-1 overflow-auto">
                {/* MODULE: list of files to drill into */}
                {view.kind === "module" && (
                  <div className="flex flex-col p-2">
                    {view.mod.files.map((f) => (
                      <button
                        key={f}
                        onClick={() => openFile(f, view.mod)}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <FileIcon path={f} className="size-3.5 shrink-0" />
                        <span className="truncate">{f}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* FILE: AI summary + real source code */}
                {view.kind === "file" && (
                  <div className="flex flex-col gap-4 p-4">
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm leading-relaxed">
                      {summaryLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-[85%]" />
                          <Skeleton className="h-3 w-[70%]" />
                        </div>
                      ) : (
                        <Markdown>{summary ?? ""}</Markdown>
                      )}
                    </div>
                    {codeLoading ? (
                      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> loading source…
                      </div>
                    ) : (
                      <CodeBlock
                        code={code ?? ""}
                        path={view.path}
                        highlightLines={codeHl}
                      />
                    )}
                  </div>
                )}

                {/* SEARCH: files containing the query + where (line count) */}
                {view.kind === "search" && (
                  <div className="flex flex-col p-2">
                    {searching ? (
                      <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> searching…
                      </div>
                    ) : view.results.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        No matches for “{view.query}”.
                      </p>
                    ) : (
                      view.results.map((r) => (
                        <button
                          key={r.path}
                          onClick={() => openFile(r.path, undefined, [view.query])}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <FileIcon path={r.path} className="size-3.5 shrink-0" />
                          <span className="flex-1 truncate">{r.path}</span>
                          <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                            {r.count}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* SEMANTIC: in-browser embedding search — ranked chunks */}
                {view.kind === "semantic" && (
                  <div className="flex flex-col p-2">
                    {semanticBusy ? (
                      <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> searching
                        embeddings…
                      </div>
                    ) : view.results.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        No semantically similar code for “{view.query}”.
                      </p>
                    ) : (
                      view.results.map((r) => (
                        <button
                          key={`${r.path}:${r.startLine}`}
                          onClick={() =>
                            openFile(r.path, undefined, queryTerms(view.query))
                          }
                          className="flex flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                        >
                          <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            <FileIcon path={r.path} className="size-3.5 shrink-0" />
                            <span className="flex-1 truncate">{r.path}</span>
                            <span className="shrink-0 rounded bg-muted px-1.5 text-[10px]">
                              L{r.startLine}
                            </span>
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 text-[10px] text-primary">
                              {(r.score * 100).toFixed(0)}%
                            </span>
                          </span>
                          <span className="line-clamp-2 whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted-foreground/70">
                            {r.text.slice(0, 160)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* QA: answer + relevant files to drill into */}
                {view.kind === "qa" && (
                  <div className="px-4 py-4 text-sm leading-relaxed">
                    {qaAnswer === null ? (
                      <div className="space-y-2.5">
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3.5 w-[92%]" />
                        <Skeleton className="h-3.5 w-[80%]" />
                        <Skeleton className="h-3.5 w-[88%]" />
                      </div>
                    ) : (
                      <Markdown>{qaAnswer}</Markdown>
                    )}
                    {highlight.length > 0 && (
                      <div className="mt-5 border-t pt-4">
                        <p className="mb-2 font-mono text-xs text-muted-foreground">
                          relevant files
                        </p>
                        <div className="flex flex-col gap-1">
                          {highlight.map((f) => (
                            <button
                              key={f}
                              onClick={() =>
                                openFile(f, undefined, queryTerms(view.question))
                              }
                              className="truncate rounded-md px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* README modal */}
        {readmeOpen && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setReadmeOpen(false)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border bg-background shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <FileText className="size-4 text-muted-foreground" />
                <span className="flex-1 font-mono text-sm font-medium">
                  README.md
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!readme}
                  onClick={() => {
                    navigator.clipboard.writeText(readme!);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy /> Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!readme}
                  onClick={downloadReadme}
                >
                  <Download /> Download
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setReadmeOpen(false)}
                >
                  <X />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {readmeLoading ? (
                  <div className="space-y-2.5">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-[90%]" />
                    <Skeleton className="h-3.5 w-[95%]" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                ) : (
                  <Markdown>{readme ?? ""}</Markdown>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats list modal (files / imports / external) */}
        {statsModal && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setStatsModal(null)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border bg-background shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <span className="flex-1 text-sm font-medium capitalize">
                  {statsModal}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {statsModal === "files"
                    ? graph.nodes.length
                    : statsModal === "imports"
                      ? graph.edges.length
                      : (graph.externalTop?.length ?? 0)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setStatsModal(null)}
                >
                  <X />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {statsModal === "files" &&
                  graph.nodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => openFileHighlight(n.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <FileIcon path={n.id} className="size-3.5 shrink-0" />
                      <span className="truncate">{n.id}</span>
                    </button>
                  ))}
                {statsModal === "imports" &&
                  graph.edges.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => openFileHighlight(e.source)}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <span className="truncate">{e.source}</span>
                      <ArrowRight className="size-3 shrink-0 opacity-40" />
                      <span className="truncate opacity-70">{e.target}</span>
                    </button>
                  ))}
                {statsModal === "external" && (
                  <div className="flex flex-wrap gap-1.5 p-2">
                    {(graph.externalTop ?? []).map((p) => (
                      <span
                        key={p}
                        className="rounded-md border px-2 py-0.5 font-mono text-xs text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Landing
      url={url}
      setUrl={setUrl}
      onAnalyze={analyze}
      onPick={analyzeUrl}
      loading={loading}
    />
  );
}
