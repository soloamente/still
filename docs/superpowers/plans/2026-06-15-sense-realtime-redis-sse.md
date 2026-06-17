# Sense Realtime (Redis + SSE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Liveblocks with Upstash Redis fan-out + Next.js SSE so Wave 1 surfaces (review comments/reactions, notification bell) update live — no watermark, ~$0 incremental cost, Postgres remains source of truth.

**Architecture:** Rename `@still/liveblocks` → `@still/realtime` (room IDs + event schemas unchanged). Elysia publishes to Redis Streams after DB commit; signed-in web clients hold one SSE connection that `XREAD BLOCK`s allowed channels. Liveblocks SDK, auth route, LiveList collab, and listing presence are removed; lists use REST reorder only.

**Tech Stack:** `@upstash/redis`, Next.js App Router Route Handlers (SSE), Elysia, Better Auth, Neon/Drizzle, `bun:test`.

**Spec:** [`docs/superpowers/specs/2026-06-15-sense-realtime-redis-sse-design.md`](../specs/2026-06-15-sense-realtime-redis-sse-design.md)

**Supersedes plan:** [`2026-06-15-liveblocks-realtime.md`](./2026-06-15-liveblocks-realtime.md) (Tasks 10–12 Liveblocks work cancelled)

**Deferred (separate plans):** Phase B listing presence (Redis TTL heartbeats), Phase C chat (WS server), LiveList co-edit.

---

## Conventions

- Redis **stream key** = `sense:stream:{roomId}` where `roomId` matches existing room strings (`review:abc`, `user:usr_1:inbox`, …)
- Publish: `XADD sense:stream:{roomId} * data {json}` + `EXPIRE` (24h) — Upstash-friendly vs long-lived SUBSCRIBE on serverless
- SSE: `data: {json}\n\n` per event; `: keepalive\n\n` every 25s
- Optional dev: unset Upstash env → publish no-op, SSE 503, poll/REST fallback
- Tests: `bun:test`, colocated `*.test.ts`
- After code changes: `graphify update .` (if available)
- Do **not** commit unless the human asks
- Executor: **one task at a time**; human **`go`** between tasks

---

## File structure

### Create

| File | Responsibility |
|------|----------------|
| `packages/realtime/` | Renamed from `packages/liveblocks/` |
| `apps/server/src/lib/realtime-publish.ts` | XADD wrapper; no-op without Redis |
| `apps/server/src/lib/realtime-publish.test.ts` | Publish + no-op tests |
| `apps/web/src/lib/realtime-redis.ts` | Shared `@upstash/redis` client factory (server-only) |
| `apps/web/src/lib/realtime-sse.ts` | Encode SSE frames + parse stream entries |
| `apps/web/src/lib/realtime-sse.test.ts` | Frame encoding tests |
| `apps/web/src/lib/realtime-stream-rate-limit.ts` | 10 connects/min/user for SSE |
| `apps/web/src/app/api/realtime/stream/route.ts` | Authenticated SSE endpoint |
| `apps/web/src/components/realtime/realtime-root-provider.tsx` | Opens EventSource when signed in |
| `apps/web/src/hooks/use-realtime-connection.ts` | `connected` boolean for poll fallback |
| `apps/web/src/hooks/use-realtime-subscription.ts` | Subscribe to room(s), callback on event |
| `apps/web/src/components/realtime/review-realtime-subscriber.tsx` | Review room listener shell |
| `apps/web/src/components/realtime/inbox-realtime-subscriber.tsx` | Inbox room listener shell |

### Modify

| File | Change |
|------|--------|
| `packages/env/src/server.ts` | Add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`; remove `LIVEBLOCKS_SECRET_KEY` |
| `packages/env/src/web.ts` | Add Upstash vars (SSE route); remove `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` |
| `apps/server/package.json` | Add `@upstash/redis`; remove `@liveblocks/node`; `@still/liveblocks` → `@still/realtime` |
| `apps/web/package.json` | Remove `@liveblocks/client`, `@liveblocks/react`; add `@upstash/redis`; `@still/realtime` |
| `apps/server/src/routes/comments.ts` | Import `publishRealtimeEvent` from `realtime-publish` |
| `apps/server/src/routes/reviews.ts` | Same |
| `apps/server/src/lib/notification-delivery.ts` | Same |
| `apps/web/src/lib/liveblocks-room-access.ts` | Rename → `realtime-room-access.ts` (update imports) |
| `apps/web/src/app/(app)/layout.tsx` | `RealtimeRootProvider` replaces `LiveblocksRootProvider` |
| `apps/web/src/components/review/review-detail-sheet.tsx` | Mount `ReviewRealtimeSubscriber` |
| `apps/web/src/components/social/comments-thread.tsx` | Handle `comment.created` via subscription hook |
| `apps/web/src/components/social/reactions-bar.tsx` | Handle `reaction.updated` |
| `apps/web/src/components/home/home-notifications-menu.tsx` | Skip poll when `useRealtimeConnection()`; handle `notification.created` |
| `apps/web/src/app/(app)/lists/[id]/page.tsx` | Remove `ListCollabRoom` wrapper; REST grid only |
| `apps/web/src/app/(app)/movies/[id]/page.tsx` | Remove `ListingPresenceRoom` |
| `apps/web/src/app/(app)/tv/[id]/page.tsx` | Remove `ListingPresenceRoom` |
| `apps/web/src/components/list/ranked-list-reorder-grid.tsx` | Remove `realtimeMode` + `useListCollab` path |

### Delete (after replacements wired)

| File |
|------|
| `apps/server/src/lib/liveblocks-broadcast.ts` (+ test) |
| `apps/server/src/lib/notification-delivery-liveblocks.test.ts` (rewrite for redis) |
| `apps/web/src/app/api/liveblocks-auth/route.ts` |
| `apps/web/src/lib/liveblocks-auth-rate-limit.ts` |
| `apps/web/src/components/realtime/liveblocks-root-provider.tsx` |
| `apps/web/src/hooks/use-liveblocks-connection.ts` |
| `apps/web/src/components/realtime/list-collab-*.tsx` |
| `apps/web/src/components/realtime/listing-presence-*.tsx` |
| `packages/liveblocks/` (after rename completes) |

---

## Task 1: Phase 0 — Remove Liveblocks watermark

**Files:**
- Modify: `apps/web/.env.local`, `apps/server/.env` (human), `docs/superpowers/specs/2026-06-15-sense-realtime-redis-sse-design.md` (reference only)

- [ ] **Step 1: Unset Liveblocks keys locally**

Remove or comment out in `apps/web/.env.local`:

```
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=
```

Remove or comment out in `apps/server/.env`:

```
LIVEBLOCKS_SECRET_KEY=
```

- [ ] **Step 2: Verify provider no-ops**

`LiveblocksRootProvider` already returns children when public key is unset (`liveblocks-root-provider.tsx`). Restart dev server.

- [ ] **Step 3: Manual check**

Open any `(app)` route → confirm **no** “Powered by Liveblocks” badge. List/movie detail still load (async behavior).

**Success criteria:** Watermark gone; no console errors blocking render.

---

## Task 2: Rename `@still/liveblocks` → `@still/realtime`

**Files:**
- Rename: `packages/liveblocks/` → `packages/realtime/`
- Modify: `packages/realtime/package.json`, root `package.json` / workspace refs, all `@still/liveblocks` imports

- [ ] **Step 1: Rename package directory**

```bash
git mv packages/liveblocks packages/realtime
```

- [ ] **Step 2: Update package.json name**

In `packages/realtime/package.json`:

```json
{
  "name": "@still/realtime",
  ...
}
```

- [ ] **Step 3: Replace imports across repo**

```bash
# From repo root — verify diff after
rg -l "@still/liveblocks" --glob "!node_modules" --glob "!graphify-out"
```

Replace `@still/liveblocks` → `@still/realtime` in `apps/server`, `apps/web`, `packages/env` (if any), and `apps/server/package.json` / `apps/web/package.json` dependency keys.

- [ ] **Step 4: Run package tests**

```bash
cd packages/realtime && bun test
```

Expected: 10 pass (room-ids + event-types).

- [ ] **Step 5: Run `bun install` at repo root**

Expected: lockfile resolves `@still/realtime`.

**Success criteria:** No `@still/liveblocks` imports remain; tests green.

---

## Task 3: Upstash env + Redis client helpers

**Files:**
- Modify: `packages/env/src/server.ts`, `packages/env/src/web.ts`
- Create: `apps/server/src/lib/realtime-redis.ts`, `apps/web/src/lib/realtime-redis.ts`

- [ ] **Step 1: Add env vars (server)**

In `packages/env/src/server.ts`, replace `LIVEBLOCKS_SECRET_KEY` with:

```ts
UPSTASH_REDIS_REST_URL: optionalUrl(),
UPSTASH_REDIS_REST_TOKEN: optionalNonEmptyString(),
```

- [ ] **Step 2: Add env vars (web)**

In `packages/env/src/web.ts`, add same two keys (SSE route runs on Next).

Remove `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY`.

- [ ] **Step 3: Server Redis factory**

Create `apps/server/src/lib/realtime-redis.ts`:

```ts
import { Redis } from "@upstash/redis";
import { env } from "@still/env/server";

let client: Redis | null = null;

export function isRealtimePublishEnabled(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRealtimeRedis(): Redis | null {
  if (!isRealtimePublishEnabled()) return null;
  client ??= new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return client;
}

/** Stream key for a logical room id. */
export function realtimeStreamKey(roomId: string): string {
  return `sense:stream:${roomId}`;
}
```

- [ ] **Step 4: Mirror web factory**

Create `apps/web/src/lib/realtime-redis.ts` with `"server-only"` import from `@still/env/web` (same pattern as `server-api.ts`).

- [ ] **Step 5: Add dependency**

In `apps/server/package.json` and `apps/web/package.json`:

```json
"@upstash/redis": "^1.34.0"
```

Run `bun install` from repo root.

**Success criteria:** `isRealtimePublishEnabled()` false without env; no boot errors.

---

## Task 4: `realtime-publish.ts` (server)

**Files:**
- Create: `apps/server/src/lib/realtime-publish.ts`
- Create: `apps/server/src/lib/realtime-publish.test.ts`
- Delete later: `liveblocks-broadcast.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, mock, test } from "bun:test";

const xaddMock = mock(async () => "1700000000000-0");
const expireMock = mock(async () => 1);

mock.module("@upstash/redis", () => ({
  Redis: class {
    xadd = xaddMock;
    expire = expireMock;
  },
}));

const envMock: Record<string, string | undefined> = {};
mock.module("@still/env/server", () => ({ env: envMock }));

const { publishRealtimeEvent, isRealtimePublishEnabled } = await import(
  "./realtime-publish"
);

describe("realtime-publish", () => {
  test("disabled without Upstash env", () => {
    envMock.UPSTASH_REDIS_REST_URL = undefined;
    expect(isRealtimePublishEnabled()).toBe(false);
  });

  test("publishes to stream key after commit", async () => {
    envMock.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    envMock.UPSTASH_REDIS_REST_TOKEN = "token";
    xaddMock.mockClear();

    await publishRealtimeEvent("review:rev_1", {
      type: "comment.created",
      commentId: "cmt_1",
      preview: "Hi",
    });

    expect(xaddMock).toHaveBeenCalled();
    const [streamKey, id, fields] = xaddMock.mock.calls[0]!;
    expect(streamKey).toBe("sense:stream:review:rev_1");
    expect(id).toBe("*");
    expect(fields).toEqual({
      data: JSON.stringify({
        type: "comment.created",
        commentId: "cmt_1",
        preview: "Hi",
      }),
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/server && bun test src/lib/realtime-publish.test.ts
```

- [ ] **Step 3: Implement**

Create `apps/server/src/lib/realtime-publish.ts`:

```ts
import type { RealtimeEvent } from "@still/realtime";
import {
  getRealtimeRedis,
  isRealtimePublishEnabled,
  realtimeStreamKey,
} from "./realtime-redis";

export { isRealtimePublishEnabled };

/** Fan out after Postgres commit. Never throws to callers. */
export async function publishRealtimeEvent(
  roomId: string,
  event: RealtimeEvent,
): Promise<void> {
  const redis = getRealtimeRedis();
  if (!redis) return;
  try {
    const key = realtimeStreamKey(roomId);
    await redis.xadd(key, "*", { data: JSON.stringify(event) });
    await redis.expire(key, 86_400);
  } catch (err) {
    console.error("[realtime] publish failed", { roomId, type: event.type, err });
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Swap server call sites**

In `comments.ts`, `reviews.ts`, `notification-delivery.ts`:

```ts
import { publishRealtimeEvent } from "../lib/realtime-publish";
// remove liveblocks-broadcast import
```

Replace `broadcastRealtimeEvent` → `publishRealtimeEvent` (same args).

Update `comments.test.ts` mock path to `./realtime-publish`.

**Success criteria:** Server tests pass; no `@liveblocks/node` usage in publish path.

---

## Task 5: Rename room access + SSE helpers

**Files:**
- Rename: `apps/web/src/lib/liveblocks-room-access.ts` → `realtime-room-access.ts`
- Rename: `apps/web/src/lib/liveblocks-room-access.test.ts` → `realtime-room-access.test.ts`
- Create: `apps/web/src/lib/realtime-sse.ts`, `realtime-sse.test.ts`
- Create: `apps/web/src/lib/realtime-stream-rate-limit.ts`

- [ ] **Step 1: Rename access module**

`git mv` both files; update exports/comments (Liveblocks → realtime). No logic change.

- [ ] **Step 2: SSE frame helper + test**

`realtime-sse.ts`:

```ts
export function encodeSseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function encodeSseKeepalive(): string {
  return `: keepalive ${Date.now()}\n\n`;
}

export function parseStreamEntryData(raw: unknown): unknown | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null && "data" in raw) {
    return parseStreamEntryData((raw as { data: unknown }).data);
  }
  return null;
}
```

Test encode produces `\n\n` terminated frames.

- [ ] **Step 3: Rate limiter**

Port pattern from `liveblocks-auth-rate-limit.ts` → `realtime-stream-rate-limit.ts` (10/min/user in-memory map).

- [ ] **Step 4: Run tests**

```bash
cd apps/web && bun test src/lib/realtime-room-access.test.ts src/lib/realtime-sse.test.ts
```

**Success criteria:** 8+ pass on room access; SSE tests pass.

---

## Task 6: SSE stream route

**Files:**
- Create: `apps/web/src/app/api/realtime/stream/route.ts`

- [ ] **Step 1: Implement GET handler**

Query: `rooms` comma-separated room ids (max 8).

Flow:

1. `authServer()` → 401 if missing
2. Rate limit connect
3. For each room, `resolveRealtimeRoomAccess(userId, room)` → filter to allowed list; 403 if empty
4. If Redis unset → 503
5. Return `ReadableStream` with `Content-Type: text/event-stream`

Loop body (simplified):

```ts
const streamKeys = allowedRooms.map(realtimeStreamKey);
const lastIds = Object.fromEntries(streamKeys.map((k) => [k, "$"]));

while (!request.signal.aborted) {
  const result = await redis.xread(streamKeys, lastIds, { block: 15_000, count: 10 });
  if (result) {
    for (const entry of result) {
      const parsed = parseRealtimeEvent(parseStreamEntryData(entry.data));
      if (parsed) controller.enqueue(encoder.encode(encodeSseData(parsed)));
      lastIds[entry.key] = entry.id;
    }
  } else {
    controller.enqueue(encoder.encode(encodeSseKeepalive()));
  }
}
```

Use `export const runtime = "nodejs"` and `maxDuration` appropriate for Vercel Fluid compute.

- [ ] **Step 2: Manual curl test (with Upstash configured)**

```bash
curl -N -H "Cookie: ..." "http://localhost:3000/api/realtime/stream?rooms=user:YOUR_ID:inbox"
```

Publish test event from Upstash console or server route → frame appears.

**Success criteria:** Authenticated client receives SSE JSON events; unsigned gets 401.

---

## Task 7: Client `RealtimeRootProvider` + hooks

**Files:**
- Create: `realtime-root-provider.tsx`, `use-realtime-connection.ts`, `use-realtime-subscription.ts`
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Connection context**

`RealtimeRootProvider`:

- When signed in + `process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false"`, open **one** `EventSource` to `/api/realtime/stream?rooms=...` — start with **inbox only** (`user:{userId}:inbox` from session prop)
- Parse `data:` lines with `parseRealtimeEvent`
- Fan-out to subscribers via `RealtimeContext`
- Reconnect with exponential backoff (cap 30s)
- Expose `connected: boolean`

- [ ] **Step 2: `useRealtimeSubscription({ room, onEvent })`**

Register/unregister listener; filter events by `room` id.

- [ ] **Step 3: Replace layout provider**

```tsx
<RealtimeRootProvider userId={session.user.id}>
  {children}
</RealtimeRootProvider>
```

Remove `LiveblocksRootProvider`.

- [ ] **Step 4: `useRealtimeConnection`**

Drop-in replacement for `useLiveblocksConnection` (same boolean semantics).

**Success criteria:** DevTools → EventSource open when signed in; closes when signed out.

---

## Task 8: Notification bell — live inbox + poll fallback

**Files:**
- Create: `inbox-realtime-subscriber.tsx`
- Modify: `home-notifications-menu.tsx`, `realtime-root-provider.tsx` (include inbox room in stream URL)

- [ ] **Step 1: On `notification.created`**

`InboxRealtimeSubscriber` (mounted in layout near bell or inside provider):

```ts
useRealtimeSubscription({
  room: userInboxRoomId(userId),
  onEvent: (event) => {
    if (event.type !== "notification.created") return;
    // trigger bell refetch or prepend via callback
  },
});
```

- [ ] **Step 2: Conditional poll**

In `HomeNotificationsMenu`:

```ts
const realtimeConnected = useRealtimeConnection();
// ...
useEffect(() => {
  if (!authenticated || realtimeConnected) {
    stop();
    return;
  }
  start(); // existing 30s poll
}, [authenticated, realtimeConnected]);
```

- [ ] **Step 3: Manual QA**

Trigger notification (follow, comment on review) → bell updates <2s without waiting 30s.

**Success criteria:** Poll stops when SSE connected; resumes on disconnect.

---

## Task 9: Review reader — live comments + reactions

**Files:**
- Create: `review-realtime-subscriber.tsx`
- Modify: `review-detail-sheet.tsx`, `comments-thread.tsx`, `reactions-bar.tsx`

- [ ] **Step 1: Subscriber component**

When review reader open, call `useRealtimeSubscription({ room: reviewRoomId(reviewId), onEvent })`.

Extend SSE stream rooms dynamically **or** open a dedicated EventSource per review reader (simpler for v1: second connection only while drawer open).

**v1 recommendation:** Per-surface EventSource in `ReviewRealtimeSubscriber` → `GET /api/realtime/stream?rooms=review:{id}` to avoid multiplexing complexity in root provider.

- [ ] **Step 2: Comments thread**

On `comment.created`:

- Refetch comments via existing API **or** append if parent matches
- If scroll not at bottom → set `hasUnreadBelow` → show **New** pill (spec copy)

- [ ] **Step 3: Reactions bar**

On `reaction.updated`:

```ts
setLikesCount(event.likesCount);
setDislikesCount(event.dislikesCount);
```

- [ ] **Step 4: Product event**

On first live comment while reader open: POST `realtime.comment.received_live` (existing kind).

- [ ] **Step 5: Manual QA**

Two browsers, same review drawer → comment + like sync without refresh.

**Success criteria:** Live updates work; refresh still matches Postgres.

---

## Task 10: Remove Liveblocks UI + list collab

**Files:**
- Modify: `lists/[id]/page.tsx`, `movies/[id]/page.tsx`, `tv/[id]/page.tsx`, `ranked-list-reorder-grid.tsx`
- Delete: list-collab-*, listing-presence-*, liveblocks-root-provider, liveblocks-auth route

- [ ] **Step 1: List detail**

Remove `ListCollabRoom`, `ListCollabPresenceBar`, `realtimeMode` prop. Ranked grid uses REST-only path (already implemented when `realtimeMode` false).

- [ ] **Step 2: Movie/TV detail**

Remove `ListingPresenceRoom` + `ListingPresenceRow` wrappers.

- [ ] **Step 3: Ranked grid cleanup**

Remove `useListCollab`, `realtimeMode` prop, and collab-specific `useEffect` branch.

- [ ] **Step 4: Delete dead files** (listed in File structure)

- [ ] **Step 5: Remove deps**

From `apps/web/package.json`: `@liveblocks/client`, `@liveblocks/react`  
From `apps/server/package.json`: `@liveblocks/node`  
Run `bun install`.

**Success criteria:** `rg liveblocks apps/web apps/server packages` → no runtime imports (docs/history ok).

---

## Task 11: Verification + docs

**Files:**
- Modify: `.cursor/scratchpad.md`
- Modify: `docs/superpowers/plans/2026-06-15-liveblocks-realtime.md` (header: superseded)

- [x] **Step 1: Automated tests** (2026-06-15)

```bash
cd packages/realtime && bun test                    # 11/11 pass
cd apps/server && bun test src/lib/00-realtime-publish.test.ts  # 3/3 pass
cd apps/server && bun test src/routes/comments.test.ts          # 3/3 pass
cd apps/server && bun test src/routes/lists.test.ts --test-name-pattern reorder  # 8/8 pass
cd apps/web && bun test src/lib/realtime-room-access.test.ts src/lib/realtime-sse.test.ts src/lib/list-reorder-live-sync.test.ts src/components/realtime/realtime-root-provider.test.ts  # 20/20 pass
```

Note: `ranked-list-reorder-grid.test.tsx` requires `NEXT_PUBLIC_SERVER_URL` in the test shell (set from `.env.local` in dev).

- [x] **Step 2: Manual QA checklist** (from spec) — signed off 2026-06-15

1. No Liveblocks watermark  
2. Review comment live in two sessions  
3. Reaction counts live  
4. Notification bell live  
5. Airplane mode → poll resumes within 30s  
6. List reorder persists via REST  
7. **List reorder live** — two tabs on same ranked list (owner/collaborator); reorder in one → other updates within ~1s (Upstash or same-browser `BroadcastChannel` fallback in dev)

- [ ] **Step 3: Vercel setup note for human**

Add Upstash Redis integration in Vercel project → env vars propagate to Preview + Production.

**Success criteria:** All automated tests pass; manual QA signed off by human.

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| No watermark | Task 1, 10 |
| ~$0 Upstash | Task 3 (human adds integration) |
| Postgres authoritative | Unchanged; publish after commit Task 4 |
| Review comments/reactions live | Task 9 |
| Notification push + poll fallback | Task 8 |
| REST list reorder only | Task 10 |
| Remove Liveblocks deps | Task 2, 4, 10 |
| Room IDs + event types preserved | Task 2 |
| Permission matrix | Task 5, 6 |
| Presence deferred | Task 10 removes presence UI |
| SSE auth rate limit | Task 5, 6 |
| Error: publish never throws | Task 4 |
| Product events client | Task 9 |

## Out of scope (no tasks)

- Listing presence (Phase B)
- LiveList collab
- Chat Wave 2
- WebRTC

---

## Human setup (before Task 6 manual QA)

1. Vercel Dashboard → Storage / Marketplace → **Upstash Redis** → connect to `still` web + server projects  
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to local `.env` / `.env.local`  
3. Remove Liveblocks keys from all environments  
