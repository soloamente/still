/**
 * Tiny in-process pub-sub keyed by chat thread id. Elysia WS handlers
 * subscribe a socket to one or more threads; HTTP handlers call
 * `broadcast(threadId, payload)` after a durable write to fan out.
 *
 * Single-process only. For multi-process we'll swap this for Postgres
 * LISTEN/NOTIFY or Redis pub-sub later — same public shape.
 */
type Sink = (payload: unknown) => void;

const subscribers = new Map<string, Set<Sink>>();
const presence = new Map<string, Set<string>>(); // userId -> threadIds typing

export function subscribe(threadId: string, sink: Sink) {
  const set = subscribers.get(threadId) ?? new Set();
  set.add(sink);
  subscribers.set(threadId, set);
  return () => {
    const s = subscribers.get(threadId);
    if (!s) return;
    s.delete(sink);
    if (s.size === 0) subscribers.delete(threadId);
  };
}

export function broadcast(threadId: string, payload: unknown) {
  const subs = subscribers.get(threadId);
  if (!subs) return;
  for (const sink of subs) {
    try {
      sink(payload);
    } catch (err) {
      console.error("[ws] sink error", err);
    }
  }
}

export function setTyping(userId: string, threadId: string, isTyping: boolean) {
  if (isTyping) {
    const set = presence.get(userId) ?? new Set();
    set.add(threadId);
    presence.set(userId, set);
  } else {
    presence.get(userId)?.delete(threadId);
  }
  broadcast(threadId, { kind: "typing", payload: { userId, isTyping } });
}

export function getPresence(threadId: string) {
  const typing: string[] = [];
  for (const [userId, set] of presence) {
    if (set.has(threadId)) typing.push(userId);
  }
  return { typing };
}
