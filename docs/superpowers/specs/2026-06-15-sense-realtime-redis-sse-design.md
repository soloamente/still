# Sense — Realtime layer (Redis pub/sub + SSE)

**Status:** Approved (2026-06-15) — replaces Liveblocks for Wave 0–1  
**Date:** 2026-06-15  
**Topic:** Vendor-neutral realtime on Vercel + Neon without Liveblocks cost or watermark  
**Supersedes:** [`2026-06-15-liveblocks-realtime-design.md`](./2026-06-15-liveblocks-realtime-design.md) for Wave 0–1 scope (Liveblocks doc retained for historical context only)  
**Parent:** [`2026-05-29-sense-product-roadmap-design.md`](./2026-05-29-sense-product-roadmap-design.md), [`sense-media-platform-strategy.md`](../../../sense-media-platform-strategy.md)

## Summary

Sense needs realtime **feel** (live comments, reaction counts, notification push) without a third SaaS bill or a **“Powered by Liveblocks”** watermark on the Free tier. Postgres (`@still/db`) remains the **source of truth**; transport is **Upstash Redis pub/sub** (publish from Elysia after commit) and **Server-Sent Events** (subscribe from Next.js on Vercel).

Wave 0–1 **defers** Liveblocks-specific features that are expensive to replicate: **LiveList collaborative reorder** and **Wave 2 chat on Liveblocks**. Lists use **REST reorder** (existing API). **Listing presence** on movie/TV detail shipped separately via Redis ZSET heartbeats — see [`2026-06-16-listing-presence-design.md`](./2026-06-16-listing-presence-design.md).

**North star unchanged:** Patrons feel social echo **while they are still in the app** — not only when they return hours later.

## Problem (why not Liveblocks)

| Issue | Impact |
|-------|--------|
| Free tier watermark | Unacceptable product chrome on a cinematic UI |
| Pro ~$30/mo | Too much incremental spend alongside Neon + Vercel pre-revenue |
| Vendor lock-in | Room/session model tied to `@liveblocks/*` SDKs |
| Vercel constraint (unchanged) | Custom Elysia WebSockets on web still invalid for production |

Liveblocks implementation (Wave 0 partial, Wave 1 partial) is **not wasted**: room IDs, event payloads, server “broadcast after commit” call sites, and room permission matrix port directly.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Transport | **Upstash Redis pub/sub** + **Next.js SSE** (`EventSource`) |
| Cost target | **~$0 incremental** — Upstash free tier via Vercel Marketplace; alert before scale |
| Postgres | **Authoritative** for all durable data (unchanged) |
| Wave 1 push surfaces | Review reader (comments + reactions), notification bell inbox |
| Wave 1 deferred | Collaborative LiveList, chat migration — **listing presence shipped separately** (see below) |
| List reorder | **REST only** — `POST /api/lists/:id/reorder`; conflict toast on failure (pre-Liveblocks behavior) |
| Disconnect fallback | **30s poll** on notification bell when SSE disconnected (keep existing spec behavior) |
| Signed-out | No SSE stream; no inbox channel |
| WebRTC | **Not** the core transport (wrong fit for server fan-out and N-viewer presence) |

## Approaches considered

### 1. Redis + SSE (chosen)

Elysia publishes after DB commit; Next.js SSE route subscribes to Redis and streams to authenticated clients.

**Pros:** Vercel-native; ~$0 at pre-launch scale; no watermark; owns protocol.  
**Cons:** One-way server→client (sufficient for Wave 1); no built-in CRDT list sync.

### 2. Stay on Liveblocks Pro

**Pros:** Zero migration eng.  
**Cons:** ~$30/mo + rejected on cost/watermark grounds.

### 3. Dedicated WebSocket server (Fly/Railway)

**Pros:** Full duplex; easier chat later.  
**Cons:** Extra deployable + ops; deferred until chat Wave 2 justifies it.

## Architecture

### Principle: Postgres authoritative, Redis ephemeral fan-out

| Data | Source of truth | Realtime role |
|------|-----------------|---------------|
| Comments, reactions, notifications | **Postgres** | Publish event after insert/update |
| List item order | **Postgres** | No live sync in Wave A — REST reorder only |
| “Who’s viewing” | **Redis ZSET** (ephemeral) | Shipped — see [`2026-06-16-listing-presence-design.md`](./2026-06-16-listing-presence-design.md) |
| Chat (Wave 2) | **Postgres** | Separate spec — likely WS server + Redis, not Liveblocks |

### Channel naming (same logical rooms as Liveblocks spec)

Redis channel id **equals** existing room id strings from `@still/liveblocks` (rename package to `@still/realtime` in implementation plan):

```
listing:movie:{tmdbId}     — listing presence heartbeats (shipped)
listing:tv:{tmdbId}        — listing presence heartbeats (shipped)
list:{listId}              — Phase B optional metadata events
review:{reviewId}          — Wave 1: comment.created, reaction.updated
user:{userId}:inbox        — Wave 1: notification.created
chat:{threadId}            — Wave 2 (future)
```

### Publish flow (server)

```text
Elysia handler → DB commit success → redis.publish(channel, JSON.stringify(event))
```

- Wrapper: `apps/server/src/lib/realtime-publish.ts` (replaces `liveblocks-broadcast.ts`).
- **Never throws** to callers; logs failures (parity with Liveblocks wrapper).
- No-op when Redis env unset (local dev without Upstash).

Call sites (already exist — swap import only):

- `apps/server/src/routes/comments.ts` — review comments
- `apps/server/src/routes/reviews.ts` — like/dislike
- `apps/server/src/lib/notification-delivery.ts` — inbox insert

### Subscribe flow (web)

```text
Client EventSource → GET /api/realtime/stream?rooms=review:abc,user:me:inbox
                 → Better Auth session + room permission check
                 → Redis SUBSCRIBE (per connection) → SSE frames
```

- One SSE connection per signed-in app shell; multiplexes allowed rooms.
- Client parses with existing `parseRealtimeEvent()` from `@still/realtime`.
- `RealtimeProvider` in `(app)/layout.tsx` replaces `LiveblocksRootProvider`.
- Hook: `useRealtimeSubscription({ rooms, onEvent })` replaces Liveblocks room hooks for Wave 1 surfaces.

**SSE frame format:** standard `data: {json}\n\n` per event; optional `: keepalive\n\n` every 15–30s.

### Auth and permissions

Reuse `apps/web/src/lib/liveblocks-room-access.ts` logic (rename to `realtime-room-access.ts`):

| Room | Subscribe allowed when |
|------|------------------------|
| `review:{id}` | Viewer can read review (same as GET comments) |
| `user:{userId}:inbox` | `session.user.id === userId` |
| Listing / list rooms | Phase B — same matrix as Liveblocks doc |

Rate-limit SSE connect: **10 new connections/minute per user** (avoid reconnect storms).

Remove `POST /api/liveblocks-auth` entirely.

### Broadcast payload contracts (unchanged)

Clients refetch or patch by id — never trust broadcast body for auth-sensitive fields.

```ts
// review:{reviewId}
{ type: "comment.created"; commentId: string; preview: string }
{ type: "reaction.updated"; likesCount: number; dislikesCount: number }

// user:{userId}:inbox
{ type: "notification.created"; notificationId: string; kind: string }
```

Defined in `packages/liveblocks/src/event-types.ts` → rename to `@still/realtime`.

### UI surfaces by phase

#### Phase 0 — Remove watermark (immediate)

- Unset `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` (and server Liveblocks secret) in all environments.
- Remove or gate Liveblocks provider mount — **no badge**.
- App behaves as async-first: notification poll, REST list reorder, no presence row.

#### Phase 1 — SSE transport (Wave 1 push)

| Surface | Behavior |
|---------|----------|
| Review reader / `CommentsThread` | On `comment.created` → fetch or append comment; **New** pill if scrolled up |
| `ReactionsBar` | On `reaction.updated` → patch counts |
| `HomeNotificationsMenu` | On `notification.created` → prepend row; **stop poll while SSE connected** |
| `/lists/[id]` ranked reorder | **REST only** — remove LiveList collab components |
| Movie/TV detail presence | **Shipped** — [`2026-06-16-listing-presence-design.md`](./2026-06-16-listing-presence-design.md) (Redis ZSET + SSE invalidation + poll) |

#### Phase 2 — Listing presence (**shipped 2026-06-16**)

Canonical spec: [`2026-06-16-listing-presence-design.md`](./2026-06-16-listing-presence-design.md). Summary:

- Client heartbeat `POST /api/realtime/presence` every ~25s with `{ room }`; `DELETE` on unmount/`pagehide`.
- Server Redis ZSET `sense:presence:{roomId}` with 45s stale prune; **server-filtered** mutual follows on `GET`.
- SSE `presence.updated` (invalidation-only) on listing room + ~20s poll when disconnected.
- UI: `ListingPresenceRow` under compact community score on `/movies/[id]` and `/tv/[id]` only.

#### Phase 3 — Chat (Wave 2, separate plan)

- Do **not** migrate chat to Liveblocks.
- Evaluate dedicated WS on Fly/Railway + Redis pub/sub when chat ships.

## Migration from Liveblocks code

### Keep / rename

| Current | Action |
|---------|--------|
| `packages/liveblocks/` | Rename → `packages/realtime/` (`@still/realtime`) |
| `room-ids.ts`, `event-types.ts`, tests | Keep |
| `liveblocks-room-access.ts` | Rename → `realtime-room-access.ts` |
| Server post-commit call sites | Change import to `realtime-publish` |
| `product_event` realtime kinds | Keep |

### Remove after Phase 1

| Asset |
|-------|
| `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/node` |
| `liveblocks-root-provider.tsx`, `use-liveblocks-connection.ts` |
| `list-collab-*.tsx`, `listing-presence-*.tsx` |
| `POST /api/liveblocks-auth` |
| `liveblocks-broadcast.ts` |
| Env: `LIVEBLOCKS_SECRET_KEY`, `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` |

### New files (implementation plan detail)

```
packages/realtime/                    # renamed from liveblocks
apps/server/src/lib/realtime-publish.ts
apps/server/src/lib/realtime-publish.test.ts
apps/web/src/app/api/realtime/stream/route.ts
apps/web/src/components/realtime/realtime-root-provider.tsx
apps/web/src/hooks/use-realtime-subscription.ts
apps/web/src/lib/realtime-room-access.ts   # moved from liveblocks-room-access
packages/env/                              # UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `UPSTASH_REDIS_REST_URL` | Server + Next (SSE route) | Redis REST / pub-sub |
| `UPSTASH_REDIS_REST_TOKEN` | Server + Next | Auth token |

Optional local dev: unset → publish no-op, SSE route 503, poll/REST fallback only.

## Error handling

| Failure | Behavior |
|---------|----------|
| Redis publish fails | Log; HTTP mutation still succeeds |
| SSE disconnect | Client reconnect with backoff; notification poll resumes |
| SSE auth denied | 403; no retry loop |
| Invalid event JSON | Drop frame; log in dev |
| List reorder conflict | Postgres wins; toast (existing copy) |

## Instrumentation

Keep existing `product_event` kinds (`realtime.comment.received_live`, etc.). Emit from **client** when first live event received while surface open — unchanged intent.

## Testing

| Layer | Coverage |
|-------|----------|
| `@still/realtime` | Room id + event parser tests (port existing) |
| `realtime-publish` | Channel + payload; no-op without env |
| `realtime-room-access` | Permission matrix (port existing tests) |
| SSE route | Mock Redis: publish → stream receives event |
| Comments/reviews routes | Mock publish; assert channel + payload after create |

Manual QA:

1. Two sessions, same review open → comment appears without refresh.
2. Like review → other session’s count updates.
3. Notification → bell updates without waiting 30s.
4. Disconnect network → bell falls back to poll within one interval.
5. No Liveblocks watermark anywhere.

## Cost and ops

- **Upstash Redis** free tier: sufficient for pre-launch; monitor command count in Upstash dashboard.
- No Liveblocks line item.
- Single SSE connection per signed-in tab — acceptable for early scale; revisit connection pooling if needed.

## Explicitly out of scope (this spec)

- LiveList / multi-editor list drag sync
- Liveblocks Comments or Notifications products
- WebRTC as primary transport
- Co-edited reviews (Yjs)
- `/home` grid presence, live Community Activity rows

## Success criteria

- [ ] No third-party realtime watermark in production
- [ ] Incremental infra cost ~$0 on Upstash free tier at launch scale
- [ ] Review comments and reaction counts update live for subscribed clients
- [ ] Notification bell updates live with poll fallback on disconnect
- [ ] All durable data still read from Postgres on refresh
- [ ] Liveblocks dependencies removed from `apps/web` and `apps/server`
