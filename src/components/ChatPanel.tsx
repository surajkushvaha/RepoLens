"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, MessageSquare, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { Thinking, THINKING_PHRASES } from "@/components/Thinking";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Thread = { threadId: string | null; title: string; updatedAt: string; count: number };

// uuid v4 — crypto.randomUUID on https, small fallback otherwise (must stay a
// valid uuid so the server's zod .uuid() accepts it)
function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    ((+c) ^ (Math.floor(Math.random() * 256) & (15 >> (+c / 4)))).toString(16),
  );
}

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function ChatPanel({
  owner,
  repo,
  getSemanticContext,
  onHighlight,
  onClose,
}: {
  owner: string;
  repo: string;
  getSemanticContext?: (
    q: string,
  ) => Promise<{ path: string; text: string; startLine: number; endLine: number }[]>;
  onHighlight?: (paths: string[]) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async (): Promise<Thread[]> => {
    try {
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      if (!res.ok) return [];
      const d = await res.json();
      const list: Thread[] = d.threads ?? [];
      setThreads(list);
      return list;
    } catch {
      return [];
    }
  }, [owner, repo]);

  const openThread = useCallback(
    async (id: string | null) => {
      setShowList(false);
      setThreadId(id);
      try {
        const res = await fetch("/api/chat/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, repo, threadId: id }),
        });
        const d = res.ok ? await res.json() : { messages: [] };
        setMessages(d.messages ?? []);
      } catch {
        setMessages([]);
      }
    },
    [owner, repo],
  );

  // On open: resume the most recent conversation, or start fresh if none.
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await loadThreads();
      if (!alive) return;
      if (list.length > 0) await openThread(list[0].threadId);
      else setThreadId(uuid());
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadThreads, openThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function newChat() {
    setThreadId(uuid());
    setMessages([]);
    setShowList(false);
  }

  async function deleteThread(id: string | null) {
    try {
      await fetch("/api/chat/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, threadId: id }),
      });
      const list = await loadThreads();
      if (id === threadId) {
        if (list.length > 0) await openThread(list[0].threadId);
        else newChat();
      }
    } catch {
      toast("Couldn't delete that conversation.");
    }
  }

  function setLastAssistant(content: string) {
    setMessages((m) => {
      const next = [...m];
      next[next.length - 1] = { role: "assistant", content };
      return next;
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || sending) return;
    setInput("");
    const isFirstTurn = messages.length === 0;

    const historyForServer = messages
      .filter((m) => m.content.trim())
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 800) }));

    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setSending(true);

    try {
      let context:
        | { path: string; text: string; startLine: number; endLine: number }[]
        | undefined;
      if (getSemanticContext) {
        try {
          context = await getSemanticContext(q);
          if (context?.length) onHighlight?.(context.map((c) => c.path));
        } catch {
          /* falls back to server-side retrieval */
        }
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, question: q, context, history: historyForServer, threadId }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setLastAssistant(data.error ?? "Failed to answer.");
        return;
      }
      const files = JSON.parse(res.headers.get("x-repolens-files") ?? "[]");
      onHighlight?.(files);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setLastAssistant(acc);
      }
      // once a brand-new thread has its first turn, refresh the history list so
      // it shows up (with its title) in the rail
      if (isFirstTurn) void loadThreads();
    } catch {
      setLastAssistant("Network error — could not reach the server.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-1 border-b px-3 py-3">
        <MessageSquare className="size-4 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm font-medium">
          {showList ? "Conversations" : `Chat with ${owner}/${repo}`}
        </span>
        <Button
          variant={showList ? "secondary" : "ghost"}
          size="icon-sm"
          title="Conversation history"
          onClick={() => setShowList((v) => !v)}
        >
          <History />
        </Button>
        <Button variant="ghost" size="icon-sm" title="New conversation" onClick={newChat}>
          <Plus />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X />
        </Button>
      </div>

      {/* history list */}
      {showList ? (
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={newChat}
            className="mb-2 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-4" /> New conversation
          </button>
          {threads.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No past conversations for this repo yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => (
                <li
                  key={t.threadId ?? "legacy"}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted ${
                    t.threadId === threadId ? "bg-muted" : ""
                  }`}
                >
                  <button className="min-w-0 flex-1 text-left" onClick={() => openThread(t.threadId)}>
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(t.updatedAt)} · {Math.ceil(t.count / 2)} messages
                    </div>
                  </button>
                  <button
                    onClick={() => deleteThread(t.threadId)}
                    title="Delete conversation"
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask anything about this repo — I&apos;ll remember the conversation as you go.
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "text-right" : ""}>
                    <div
                      className={`inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-left text-sm ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card"
                      }`}
                    >
                      {m.role === "assistant" && m.content === "" ? (
                        <Thinking phrases={THINKING_PHRASES.chat} compact />
                      ) : m.role === "assistant" ? (
                        <Markdown>{m.content}</Markdown>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* composer */}
          <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a follow-up…"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              <Send />
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
