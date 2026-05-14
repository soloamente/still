"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { cn } from "@still/ui/lib/utils";
import { Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatDistanceToNowStrict } from "@/lib/format";

type Thread = {
  thread: {
    id: string;
    kind: "dm" | "group";
    title: string | null;
    lastMessageAt: string;
    lastMessagePreview: string | null;
  };
  members: {
    chatMember: { userId: string };
    user: { id: string; name: string; image: string | null } | null;
    profile: { handle: string; displayName: string } | null;
  }[];
};

type Message = {
  id: string;
  threadId: string;
  userId: string;
  body: string | null;
  createdAt: string;
};

type MessageRow = {
  chatMessage: Message;
  user: { id: string; name: string; image: string | null } | null;
  profile: { handle: string; displayName: string } | null;
};

type WsEvent =
  | { type: "message"; message: Message }
  | { type: "typing"; threadId: string; userId: string; isTyping: boolean }
  | { type: "presence"; threadId: string; userIds: string[] };

/**
 * Split-pane chat. Left column lists threads, right column renders the
 * active conversation. WebSocket connection is held open as long as the
 * page mounts; events fan out to the message list / typing state via
 * local refs to avoid React-render churn.
 */
export function ChatPane({ threads: initialThreads }: { threads: Thread[] }) {
  const [threads] = useState(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(threads[0]?.thread.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => threads.find((t) => t.thread.id === activeId) ?? null,
    [threads, activeId],
  );

  // Open a single WS connection on mount. Re-joining a thread is a cheap
  // client-side message — no reconnects.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apiUrl =
      process.env.NEXT_PUBLIC_SERVER_URL ?? `${window.location.protocol}//${window.location.host}`;
    const url = `${apiUrl.replace(/^http/, "ws")}/ws/chat`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (raw) => {
      try {
        const evt = JSON.parse(raw.data) as WsEvent;
        if (evt.type === "message") {
          if (evt.message.threadId !== activeId) return;
          setMessages((m) => [...m, evt.message]);
        } else if (evt.type === "typing") {
          if (evt.threadId !== activeId) return;
          setTypingUsers((prev) => {
            const next = new Set(prev);
            if (evt.isTyping) next.add(evt.userId);
            else next.delete(evt.userId);
            return next;
          });
        }
      } catch {}
    };
    ws.onerror = () => toast.error("Lost connection — retry by refreshing");
    return () => {
      ws.close();
      wsRef.current = null;
    };
    // We intentionally do NOT include activeId — opening a new socket on
    // every thread switch is wasteful. Joining/leaving rooms uses a
    // separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tell the server which thread we're focused on so it only delivers
  // events for it.
  useEffect(() => {
    if (!activeId) return;
    const ws = wsRef.current;
    if (!ws) return;
    const send = () => ws.send(JSON.stringify({ type: "join", threadId: activeId }));
    if (ws.readyState === ws.OPEN) send();
    else ws.addEventListener("open", send, { once: true });
    return () => {
      try {
        ws.send(JSON.stringify({ type: "leave", threadId: activeId }));
      } catch {}
    };
  }, [activeId]);

  // Hydrate messages whenever the active thread switches.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    api.api.chat
      .threads({ id: activeId })
      .messages.get()
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data as unknown as MessageRow[]) ?? [];
        setMessages(rows.map((r) => r.chatMessage));
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Auto-scroll on new messages, but not on initial mount of an empty list.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const sendDraft = useCallback(async () => {
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft("");
    try {
      const res = await api.api.chat.threads({ id: activeId }).messages.post({ body });
      const msg = res.data as Message | null;
      if (msg) setMessages((prev) => [...prev, msg]);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send");
      setDraft(body);
    }
  }, [activeId, draft]);

  return (
    <div className="-mx-4 grid h-[calc(100svh-3.5rem)] grid-cols-[260px_1fr] gap-0 sm:-mx-6 lg:-mx-8 xl:-mx-12 2xl:-mx-16">
      <aside className="overflow-y-auto border-r border-border bg-card/40">
        <h2 className="px-4 pb-3 pt-4 font-display text-xl tracking-[-0.01em]">Chats</h2>
        <ul>
          {threads.map((t) => {
            const title =
              t.thread.title ??
              t.members
                .map((m) => m.profile?.displayName ?? m.user?.name ?? "Someone")
                .slice(0, 3)
                .join(", ");
            return (
              <li key={t.thread.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(t.thread.id)}
                  className={cn(
                    "block w-full border-l-2 border-transparent px-4 py-3 text-left transition-colors",
                    activeId === t.thread.id
                      ? "border-l-desert-orange bg-card"
                      : "hover:bg-card",
                  )}
                >
                  <p className="truncate text-sm font-medium">{title}</p>
                  {t.thread.lastMessagePreview ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {t.thread.lastMessagePreview}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No messages yet</p>
                  )}
                </button>
              </li>
            );
          })}
          {threads.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No chats yet. Start one from a profile.
            </li>
          ) : null}
        </ul>
      </aside>
      <section className="flex min-h-0 flex-col">
        {active ? (
          <>
            <header className="border-b border-border px-4 py-3">
              <h3 className="font-serif text-lg">
                {active.thread.title ??
                  active.members
                    .map((m) => m.profile?.displayName ?? m.user?.name ?? "Someone")
                    .join(", ")}
              </h3>
              {typingUsers.size > 0 ? (
                <p className="text-xs text-muted-foreground">Typing…</p>
              ) : null}
            </header>
            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4">
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className="max-w-[70%] rounded-2xl border border-border bg-card/60 px-3 py-2 text-sm"
                  >
                    {m.body}
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(m.createdAt))} ago
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="border-t border-border p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendDraft();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message…"
                  spellCheck={false}
                  autoComplete="off"
                />
                <Button type="submit" variant="accent" size="icon-pill" aria-label="Send">
                  <Send className="size-3.5" />
                </Button>
              </form>
            </footer>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            Select a thread to begin
          </div>
        )}
      </section>
    </div>
  );
}

