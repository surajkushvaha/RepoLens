"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { Thinking, THINKING_PHRASES } from "@/components/Thinking";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatPanel({
  owner,
  repo,
  getSemanticContext,
  onHighlight,
  onClose,
}: {
  owner: string;
  repo: string;
  // optional: pull in-browser semantic hits for the question, same as Ask
  getSemanticContext?: (
    q: string,
  ) => Promise<{ path: string; text: string; startLine: number; endLine: number }[]>;
  onHighlight?: (paths: string[]) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setMessages(d.messages ?? []))
      .catch(() => alive && setHistoryError(true))
      .finally(() => alive && setLoadingHistory(false));
    return () => {
      alive = false;
    };
  }, [owner, repo]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Overwrite the trailing placeholder bubble (added the instant we send) with
  // real content — used for the streamed answer and for any error path, so we
  // never append a second bubble.
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
    setInput(""); // clear immediately so the box is ready for the next question

    // The conversation so far, from THIS session's state — sent to the server
    // as the source of truth for context, so follow-ups work immediately
    // regardless of whether the server-side history round-trip succeeds.
    const historyForServer = messages
      .filter((m) => m.content.trim())
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 800) }));

    // Add the user bubble AND an assistant placeholder in the same tick, so
    // "Thinking…" appears the instant you hit send — never a blank gap.
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
        body: JSON.stringify({ owner, repo, question: q, context, history: historyForServer }),
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
    } catch {
      setLastAssistant("Network error — could not reach the server.");
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    try {
      await fetch("/api/chat/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      setMessages([]);
      toast("Started a fresh conversation.");
    } catch {
      toast("Couldn't reset the conversation.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="size-4 text-primary" />
        <span className="flex-1 text-sm font-medium">
          Chat with {owner}/{repo}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={reset} title="Start a new conversation">
          <RotateCcw />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loadingHistory ? (
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        ) : historyError ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your past conversation for this repo — you can still
            chat, it just won&apos;t include earlier turns from another session.
          </p>
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
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border bg-card"
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
    </div>
  );
}
