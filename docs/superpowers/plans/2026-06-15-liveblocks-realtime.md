# Liveblocks Realtime Layer Implementation Plan

> **SUPERSEDED** by [`2026-06-15-sense-realtime-redis-sse.md`](./2026-06-15-sense-realtime-redis-sse.md) (2026-06-15). Do not execute remaining Liveblocks tasks.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Wave 0–1 Liveblocks realtime — viewing presence on title detail, collaborative list reorder, and hybrid instant comments/reactions/notifications — while Postgres remains the source of truth.

**Architecture:** `@still/liveblocks` owns room IDs, event types, and permission helpers. Next.js mints sessions via Better Auth; Elysia calls `@liveblocks/node` `broadcastEvent` after DB commits. Clients subscribe per-surface rooms; list order uses LiveList with debounced flush to existing `POST /api/lists/:id/reorder`.

**Tech Stack:** Liveblocks (`@liveblocks/client`, `@liveblocks/react`, `@liveblocks/node`), Next.js App Router, Elysia, Drizzle/Neon, Better Auth, `bun:test`.

**Spec:** [`docs/superpowers/specs/2026-06-15-liveblocks-realtime-design.md`](../specs/2026-06-15-liveblocks-realtime-design.md)

**Deferred to follow-up plan:** Wave 2 chat migration, Wave 3 co-reviews / Journal / live Activity.

---

## Conventions

- Room IDs: `listing:movie:{id}`, `listing:tv:{id}`, `list:{id}`, `review:{id}`, `user:{userId}:inbox`
- Mutual-follow names on presence: client filters with existing follow APIs; Wave 1 “friends” = `follow.isMutual`
- Liveblocks optional in dev: when `LIVEBLOCKS_SECRET_KEY` unset, broadcast helpers no-op; provider skips mount
- Tests: `bun:test`, colocated `*.test.ts`
- After code changes: `graphify update .`
- Do **not** commit unless the human asks
- Executor: **one task at a time**; human **`go`** between tasks

---

## File structure

### Create

| File | Responsibility |
|------|----------------|
| `packages/liveblocks/package.json` | Workspace package |
| `packages/liveblocks/tsconfig.json` | Extends `@still/config` |
| `packages/liveblocks/src/room-ids.ts` | Room ID builders + parsers |
| `packages/liveblocks/src/room-ids.test.ts` | Round-trip tests |
| `packages/liveblocks/src/event-types.ts` | Broadcast payload discriminated union + Zod parsers |
| `packages/liveblocks/src/event-types.test.ts` | Parser tests |
| `packages/liveblocks/src/index.ts` | Re-exports |
| `apps/server/src/lib/liveblocks-broadcast.ts` | Server broadcast wrapper (no-op without secret) |
| `apps/server/src/lib/liveblocks-broadcast.test.ts` | Payload + no-op tests |
| `apps/web/src/app/api/liveblocks-auth/route.ts` | Session mint + room permissions |
| `apps/web/src/lib/liveblocks-auth.test.ts` | Permission matrix unit tests |
| `apps/web/src/components/realtime/liveblocks-root-provider.tsx` | Client provider + auth endpoint |
| `apps/web/src/components/realtime/listing-presence-room.tsx` | Join listing room wrapper |
| `apps/web/src/components/realtime/listing-presence-row.tsx` | “N patrons viewing” UI |
| `apps/web/src/components/realtime/listing-presence-row.test.ts` | Mutual-follow name filter |
| `apps/web/src/components/realtime/list-collab-room.tsx` | List room + LiveList sync shell |
| `apps/web/src/components/realtime/list-collab-presence-bar.tsx` | “You and @handle are editing” |
| `apps/web/src/components/realtime/review-realtime-room.tsx` | Subscribe `review:{id}` events |
| `apps/web/src/components/realtime/inbox-realtime-room.tsx` | Subscribe `user:{id}:inbox` |
| `apps/web/src/hooks/use-liveblocks-connection.ts` | `connected` flag for poll fallback |

### Modify

| File | Change |
|------|--------|
| `packages/env/src/server.ts` | `LIVEBLOCKS_SECRET_KEY` optional |
| `packages/env/src/web.ts` | `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` optional |
| `apps/server/package.json` | `@liveblocks/node`, `@still/liveblocks` |
| `apps/web/package.json` | `@liveblocks/client`, `@liveblocks/react`, `@still/liveblocks` |
| `apps/server/src/lib/product-event-kinds.ts` | Realtime event kinds |
| `apps/server/src/routes/comments.ts` | Broadcast `comment.created` on review comments |
| `apps/server/src/routes/reviews.ts` | Broadcast `reaction.updated` on like/dislike |
| `apps/server/src/lib/notification-delivery.ts` | Broadcast `notification.created` after insert |
| `apps/web/src/app/(app)/layout.tsx` | Mount `LiveblocksRootProvider` when session exists |
| `apps/web/src/app/(app)/movies/[id]/page.tsx` | Wrap presence row under community hero |
| `apps/web/src/app/(app)/tv/[id]/page.tsx` | Same |
| `apps/web/src/app/(app)/lists/[id]/page.tsx` | Wrap ranked grid in `ListCollabRoom` |
| `apps/web/src/components/list/ranked-list-reorder-grid.tsx` | Optional LiveList-driven reorder path |
| `apps/web/src/components/review/review-detail-sheet.tsx` | `ReviewRealtimeRoom` + live comment patch |
| `apps/web/src/components/social/comments-thread.tsx` | Handle `comment.created` event |
| `apps/web/src/components/social/reactions-bar.tsx` | Handle `reaction.updated` event |
| `apps/web/src/components/home/home-notifications-menu.tsx` | Inbox room + conditional poll fallback |
| `docs/superpowers/specs/2026-06-15-liveblocks-realtime-design.md` | Status → Approved |

---

## Wave 0 — Foundation

### Task 1: `@still/liveblocks` package (room IDs + event types)

**Files:**
- Create: `packages/liveblocks/package.json`, `tsconfig.json`, `src/room-ids.ts`, `src/event-types.ts`, `src/index.ts`
- Create: `packages/liveblocks/src/room-ids.test.ts`, `src/event-types.test.ts`

- [ ] **Step 1: Write failing room ID tests**

```ts
// packages/liveblocks/src/room-ids.test.ts
import { describe, expect, test } from "bun:test";
import {
  listingMovieRoomId,
  listingTvRoomId,
  listRoomId,
  parseListingMovieRoomId,
  reviewRoomId,
  userInboxRoomId,
} from "./room-ids";

describe("room-ids", () => {
  test("listing movie round-trip", () => {
    expect(listingMovieRoomId(550)).toBe("listing:movie:550");
    expect(parseListingMovieRoomId("listing:movie:550")).toBe(550);
  });

  test("inbox room", () => {
    expect(userInboxRoomId("usr_1")).toBe("user:usr_1:inbox");
  });

  test("list and review rooms", () => {
    expect(listRoomId("lst_1")).toBe("list:lst_1");
    expect(reviewRoomId("rev_1")).toBe("review:rev_1");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun test packages/liveblocks/src/room-ids.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement package**

`packages/liveblocks/package.json`:

```json
{
  "name": "@still/liveblocks",
  "type": "module",
  "exports": { ".": { "default": "./src/index.ts" } },
  "scripts": { "check-types": "tsc --noEmit" },
  "devDependencies": {
    "@still/config": "workspace:*",
    "typescript": "^6"
  }
}
```

`packages/liveblocks/src/room-ids.ts`:

```ts
export function listingMovieRoomId(tmdbId: number | string): string {
  return `listing:movie:${tmdbId}`;
}

export function listingTvRoomId(tmdbId: number | string): string {
  return `listing:tv:${tmdbId}`;
}

export function parseListingMovieRoomId(roomId: string): number | null {
  const m = /^listing:movie:(\d+)$/.exec(roomId);
  return m ? Number(m[1]) : null;
}

export function parseListingTvRoomId(roomId: string): number | null {
  const m = /^listing:tv:(\d+)$/.exec(roomId);
  return m ? Number(m[1]) : null;
}

export function listRoomId(listId: string): string {
  return `list:${listId}`;
}

export function reviewRoomId(reviewId: string): string {
  return `review:${reviewId}`;
}

export function userInboxRoomId(userId: string): string {
  return `user:${userId}:inbox`;
}

export function chatRoomId(threadId: string): string {
  return `chat:${threadId}`;
}
```

`packages/liveblocks/src/event-types.ts`:

```ts
import { z } from "zod";

export const realtimeCommentCreatedEventSchema = z.object({
  type: z.literal("comment.created"),
  commentId: z.string(),
  preview: z.string(),
});

export const realtimeReactionUpdatedEventSchema = z.object({
  type: z.literal("reaction.updated"),
  likesCount: z.number().int().nonnegative(),
  dislikesCount: z.number().int().nonnegative(),
});

export const realtimeNotificationCreatedEventSchema = z.object({
  type: z.literal("notification.created"),
  notificationId: z.string(),
  kind: z.string(),
});

export const realtimeEventSchema = z.discriminatedUnion("type", [
  realtimeCommentCreatedEventSchema,
  realtimeReactionUpdatedEventSchema,
  realtimeNotificationCreatedEventSchema,
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export function parseRealtimeEvent(data: unknown): RealtimeEvent | null {
  const parsed = realtimeEventSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
```

`packages/liveblocks/src/index.ts` — re-export both modules.

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun test packages/liveblocks/src/room-ids.test.ts packages/liveblocks/src/event-types.test.ts`

- [ ] **Step 5: Commit** (only if human asked)

---

### Task 2: Environment variables + dependencies

**Files:**
- Modify: `packages/env/src/server.ts`, `packages/env/src/web.ts`
- Modify: `apps/server/package.json`, `apps/web/package.json`

- [ ] **Step 1: Add optional Liveblocks keys to env schemas**

In `packages/env/src/server.ts` `serverEnv`:

```ts
LIVEBLOCKS_SECRET_KEY: optionalNonEmptyString(),
```

In `packages/env/src/web.ts` `client`:

```ts
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY: z.string().min(1).optional(),
```

and `runtimeEnv` entry.

- [ ] **Step 2: Install packages**

Run from repo root:

```bash
bun add @liveblocks/node --filter server
bun add @liveblocks/client @liveblocks/react --filter web
```

Add `"@still/liveblocks": "workspace:*"` to `apps/server` and `apps/web` dependencies.

- [ ] **Step 3: Run install**

Run: `bun install`  
Expected: lockfile updated, no peer errors

- [ ] **Step 4: Document local `.env`**

Add to dev env (human / Vercel dashboard — not committed):

```
LIVEBLOCKS_SECRET_KEY=sk_dev_...
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=pk_dev_...
```

---

### Task 3: Server broadcast helper

**Files:**
- Create: `apps/server/src/lib/liveblocks-broadcast.ts`
- Create: `apps/server/src/lib/liveblocks-broadcast.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test } from "bun:test";
import { isLiveblocksBroadcastEnabled } from "./liveblocks-broadcast";

describe("liveblocks-broadcast", () => {
  test("disabled without secret", () => {
    expect(isLiveblocksBroadcastEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { Liveblocks } from "@liveblocks/node";
import type { RealtimeEvent } from "@still/liveblocks";
import { env } from "@still/env/server";

let client: Liveblocks | null = null;

export function isLiveblocksBroadcastEnabled(): boolean {
  return Boolean(env.LIVEBLOCKS_SECRET_KEY);
}

function getClient(): Liveblocks | null {
  if (!env.LIVEBLOCKS_SECRET_KEY) return null;
  client ??= new Liveblocks({ secret: env.LIVEBLOCKS_SECRET_KEY });
  return client;
}

/** Fan out after Postgres commit. Never throws to callers. */
export async function broadcastRealtimeEvent(
  roomId: string,
  event: RealtimeEvent,
): Promise<void> {
  const lb = getClient();
  if (!lb) return;
  try {
    await lb.broadcastEvent(roomId, event);
  } catch (err) {
    console.error("[liveblocks] broadcast failed", { roomId, type: event.type, err });
  }
}
```

- [ ] **Step 3: Run test**

Run: `bun test apps/server/src/lib/liveblocks-broadcast.test.ts`

---

### Task 4: Liveblocks auth API route

**Files:**
- Create: `apps/web/src/app/api/liveblocks-auth/route.ts`
- Create: `apps/web/src/lib/liveblocks-room-access.ts`
- Create: `apps/web/src/lib/liveblocks-room-access.test.ts`

- [ ] **Step 1: Write permission tests**

Test matrix:
- Signed-out → deny
- `listing:movie:*` → any signed-in user may enter with read + presence
- `user:{other}:inbox` → deny
- `user:{self}:inbox` → allow
- `list:{id}` write → only when `canEditList` (mock helper)

- [ ] **Step 2: Implement `liveblocks-room-access.ts`**

Export `resolveLiveblocksRoomAccess(sessionUserId, roomId): Promise<"allow" | "read" | "deny">` using:
- `canEditList` / `canViewList` from server via Eden in route OR duplicate lightweight checks — **prefer calling Elysia** `GET /api/lists/:id` for list rooms in auth route with cookie forward
- Listing rooms: `"allow"` for signed-in
- Inbox: `"allow"` only when room user id matches session
- Review rooms: `"read"` default (broadcast-only subscribers)

- [ ] **Step 3: Implement auth route**

Pattern:

```ts
import { Liveblocks } from "@liveblocks/node";
import { authServer } from "@/lib/auth-server";
import { resolveLiveblocksRoomAccess } from "@/lib/liveblocks-room-access";

export async function POST(request: Request) {
  const session = await authServer();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return new Response("Liveblocks not configured", { status: 503 });

  const { room } = (await request.json()) as { room?: string };
  if (!room) return new Response("Bad request", { status: 400 });

  const access = await resolveLiveblocksRoomAccess(session.user.id, room);
  if (access === "deny") return new Response("Forbidden", { status: 403 });

  const liveblocks = new Liveblocks({ secret });
  const sessionAuth = liveblocks.prepareSession(session.user.id, {
    userInfo: {
      name: session.user.name ?? "Patron",
      avatar: session.user.image ?? undefined,
    },
  });

  if (access === "allow") sessionAuth.allow(room, sessionAuth.FULL_ACCESS);
  else sessionAuth.allow(room, sessionAuth.READ_ACCESS);

  const { status, body } = await sessionAuth.authorize();
  return new Response(body, { status });
}
```

Add rate limit: reuse `hit(\`liveblocks-auth:${userId}\`, { limit: 60, windowMs: 60_000 })` — implement via small inline map or import server rate limit through a Next route helper.

- [ ] **Step 4: Manual smoke**

With dev keys set, `curl -X POST http://localhost:3000/api/liveblocks-auth -H 'Cookie: ...' -d '{"room":"listing:movie:550"}'` → 200 + auth body

---

### Task 5: `LiveblocksRootProvider` in app shell

**Files:**
- Create: `apps/web/src/components/realtime/liveblocks-root-provider.tsx`
- Create: `apps/web/src/hooks/use-liveblocks-connection.ts`
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Implement provider**

```tsx
"use client";

import { LiveblocksProvider } from "@liveblocks/react";
import type { ReactNode } from "react";

export function LiveblocksRootProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  if (!enabled || !process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY) {
    return <>{children}</>;
  }
  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      throttle={100}
    >
      {children}
    </LiveblocksProvider>
  );
}
```

- [ ] **Step 2: Mount in `(app)/layout.tsx`**

Inside `AppShell`, wrap children:

```tsx
<LiveblocksRootProvider enabled={Boolean(session)}>
  {children}
</LiveblocksRootProvider>
```

Pass `session.user.id` to inbox subscriber via separate client child if needed.

- [ ] **Step 3: Verify build**

Run: `bun run check-types --filter web`

---

### Task 6: Product event kinds

**Files:**
- Modify: `apps/server/src/lib/product-event-kinds.ts`

- [ ] **Step 1: Add kinds**

```ts
"realtime.presence.join",
"realtime.presence.leave",
"realtime.list.coedit",
"realtime.comment.received_live",
"realtime.notification.push_received",
"realtime.list.sync_conflict",
```

Add to `CLIENT_PRODUCT_EVENT_KINDS` where client-emitted:

```ts
"realtime.presence.join",
"realtime.presence.leave",
"realtime.comment.received_live",
"realtime.notification.push_received",
```

- [ ] **Step 2: Run server tests**

Run: `bun test apps/server/src/routes/product-events.ts` (or full server test suite if exists)

---

## Wave 1 — Liveness (title detail presence)

### Task 7: Listing presence row (movie + TV)

**Files:**
- Create: `listing-presence-room.tsx`, `listing-presence-row.tsx`, `listing-presence-row.test.ts`
- Modify: `movies/[id]/page.tsx`, `tv/[id]/page.tsx`

- [ ] **Step 1: Write mutual-follow filter test**

```ts
import { describe, expect, test } from "bun:test";
import { filterMutualPresenceUserIds } from "./listing-presence-row";

describe("filterMutualPresenceUserIds", () => {
  test("keeps only mutual follows", () => {
    const mutualIds = new Set(["u2", "u3"]);
    expect(
      filterMutualPresenceUserIds(["u1", "u2", "u4"], "u_self", mutualIds),
    ).toEqual(["u2"]);
  });
});
```

Export pure helper from `listing-presence-row.tsx` for testing.

- [ ] **Step 2: Implement `ListingPresenceRoom`**

Uses `RoomProvider` + `id={listingMovieRoomId(tmdbId)}` and `initialPresence={{ surface: "movie" }}`.

On mount: `POST /api/product-events` with `realtime.presence.join` (client).

- [ ] **Step 3: Implement `ListingPresenceRow`**

Uses `useOthers()`, `useSelf()`:
- `othersCount = others.length` (exclude self from copy; spec: hide when no other patrons)
- Fetch mutual follow ids for current user once via `api.api.follows` or existing profile graph endpoint — cache in `useRef`
- Render: `PatronPortraitAvatar` for up to 3 mutuals + `@handle` links
- Copy: `{n} patron{s} viewing`
- `useReducedMotion` — no count animation when reduced

- [ ] **Step 4: Insert in movie/TV pages**

Below `MovieDetailCommunityRatingHero variant="compact"`:

```tsx
<ListingPresenceRoom listingKind="movie" listingId={id}>
  <ListingPresenceRow />
</ListingPresenceRoom>
```

TV page: `listingKind="tv"`.

- [ ] **Step 5: Manual QA**

Two signed-in browsers on same movie → count increments; mutual follows see handles.

---

## Wave 1 — Co-creation (collaborative lists)

### Task 8: List collab room + LiveList flush

**Files:**
- Create: `list-collab-room.tsx`, `list-collab-presence-bar.tsx`
- Modify: `lists/[id]/page.tsx`, `ranked-list-reorder-grid.tsx`

- [ ] **Step 1: Define LiveList storage schema**

In `list-collab-room.tsx`:

```ts
type Storage = {
  itemIds: LiveList<string>;
};
```

- [ ] **Step 2: Hydrate from Postgres on enter**

On `RoomProvider` mount with `canEdit`:
1. Read `itemIds` from `initialRows` prop (from RSC page)
2. `room.getStorage()` → set LiveList to server order if empty or stale

- [ ] **Step 3: Wire reorder grid**

Add prop `realtimeMode?: boolean` to `RankedListReorderGrid`:
- When true, `onReorder` updates LiveList instead of immediate API
- `ListCollabRoom` debounces 500ms → `api.api.lists({ id }).reorder.post({ itemIds })`
- On failure: toast + `recordProductEvent(..., "realtime.list.sync_conflict")` + reset LiveList from `committedRows`

- [ ] **Step 4: Presence bar**

`useOthers()` filtered to editors with `presence.isEditing === true` (set on mount for `canEdit`).

Copy:
- Solo: `You're editing`
- Pair: `You and @handle are editing`
- Visitors read-only: `2 curators editing`

- [ ] **Step 5: Wrap list detail page**

```tsx
<ListCollabRoom listId={id} canEdit={canReorder} initialItemIds={rankedRows.map(r => r.itemId)}>
  <ListCollabPresenceBar canEdit={canReorder} />
  {canReorder && rankedRows ? (
    <RankedListReorderGrid realtimeMode ... />
  ) : (
    <ListDetailFilmsGrid ... />
  )}
</ListCollabRoom>
```

- [ ] **Step 6: Manual QA**

Two collaborators drag reorder → both see live order → refresh → Postgres order persisted.

---

## Wave 1 — Instant feedback (hybrid broadcast)

### Task 9: Server broadcasts after writes

**Files:**
- Modify: `apps/server/src/routes/comments.ts`
- Modify: `apps/server/src/routes/reviews.ts` (like/dislike handlers)
- Modify: `apps/server/src/lib/notification-delivery.ts`

- [ ] **Step 1: Comment broadcast**

After successful review comment insert in `comments.ts`:

```ts
import { reviewRoomId } from "@still/liveblocks";
import { broadcastRealtimeEvent } from "../lib/liveblocks-broadcast";

if (body.parentType === "review") {
  void broadcastRealtimeEvent(reviewRoomId(body.parentId), {
    type: "comment.created",
    commentId: id,
    preview: body.body.slice(0, 120),
  });
}
```

- [ ] **Step 2: Reaction broadcast**

After like/dislike toggle updates counts in `reviews.ts`:

```ts
void broadcastRealtimeEvent(reviewRoomId(params.id), {
  type: "reaction.updated",
  likesCount: updated.likesCount,
  dislikesCount: updated.dislikesCount,
});
```

- [ ] **Step 3: Notification broadcast**

In `deliverNotification` after `db.insert(notification)`:

```ts
import { userInboxRoomId } from "@still/liveblocks";

void broadcastRealtimeEvent(userInboxRoomId(input.userId), {
  type: "notification.created",
  notificationId: inserted.id,
  kind: input.kind,
});
```

- [ ] **Step 4: Server tests**

Mock `broadcastRealtimeEvent` in route tests; assert called with expected room + payload on comment create.

---

### Task 10: Review reader live updates

**Files:**
- Create: `review-realtime-room.tsx`
- Modify: `review-detail-sheet.tsx`, `comments-thread.tsx`, `reactions-bar.tsx`

- [ ] **Step 1: `ReviewRealtimeRoom`**

`RoomProvider id={reviewRoomId(reviewId)}` + `useEventListener` hook:

```ts
useEventListener(({ event }) => {
  const parsed = parseRealtimeEvent(event);
  if (!parsed) return;
  onRealtimeEvent(parsed);
});
```

- [ ] **Step 2: Comments thread**

On `comment.created`:
- Fetch single comment via existing GET or append optimistic row after `GET /api/comments?parentType=review&parentId=`
- Track `hasUnreadBelow` when scroll not at bottom → show **New** pill

- [ ] **Step 3: Reactions bar**

On `reaction.updated`: patch `likesCount` / `dislikesCount` state.

- [ ] **Step 4: Client product event**

On first live comment while reader open: `realtime.comment.received_live`.

---

### Task 11: Notification bell live inbox

**Files:**
- Create: `inbox-realtime-room.tsx`
- Modify: `home-notifications-menu.tsx`

- [ ] **Step 1: Inbox room subscriber**

Mount `InboxRealtimeRoom` inside `HomeNotificationsMenu` when `authenticated`.

On `notification.created`:
- Prepend row via `fetchNotifications()` or patch from `notificationId`
- `recordProductEvent(..., "realtime.notification.push_received")`

- [ ] **Step 2: Conditional poll fallback**

```ts
const liveblocksConnected = useLiveblocksConnection();

useEffect(() => {
  if (!authenticated) return;
  if (liveblocksConnected) return; // skip interval
  // existing 30s poll
}, [authenticated, liveblocksConnected]);
```

`useLiveblocksConnection` wraps `useStatus()` from `@liveblocks/react` → `status === "connected"`.

- [ ] **Step 3: Manual QA**

User A likes User B's review → B's bell updates without reopening menu (tab foregrounded).

---

## Wave 1 — Verification

### Task 12: Automated + manual verification

- [ ] **Step 1: Run unit tests**

```bash
bun test packages/liveblocks/src
bun test apps/server/src/lib/liveblocks-broadcast.test.ts
bun test apps/web/src/components/realtime/listing-presence-row.test.ts
bun test apps/web/src/lib/liveblocks-room-access.test.ts
```

- [ ] **Step 2: Typecheck monorepo**

```bash
bun run check-types
```

- [ ] **Step 3: Build web**

```bash
bun run build --filter=web
```

- [ ] **Step 4: Manual QA checklist**

| # | Scenario | Pass |
|---|----------|------|
| 1 | Movie detail alone — no presence row | |
| 2 | Two patrons same movie — “1 patron viewing” | |
| 3 | Mutual follows see `@handle` chips | |
| 4 | Two editors reorder list live + persist | |
| 5 | Flush failure shows toast + reverts | |
| 6 | Comment appears live in open review reader | |
| 7 | Bell updates live; poll resumes when LB disconnected | |

- [ ] **Step 5: Update spec status**

Set `2026-06-15-liveblocks-realtime-design.md` **Status:** Approved — Wave 0–1 implemented

- [ ] **Step 6: `graphify update .`**

---

## Wave 2 preview (separate plan — do not start until Wave 1 shipped)

| Task | Summary |
|------|---------|
| W2.1 | `chat:{threadId}` room + broadcast on `POST` message |
| W2.2 | Rewrite `chat-pane.tsx` with `@liveblocks/react` |
| W2.3 | Typing via presence |
| W2.4 | Delete `apps/server/src/ws/*`; remove WS from server boot |
| W2.5 | Parity QA + `chat.message` notifications |

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| Postgres SoT | Tasks 8–9 flush/broadcast after DB |
| Anonymous + mutual presence | Task 7 |
| Collaborative lists Wave 1 | Task 8 |
| Hybrid comments/reactions/notif | Tasks 9–11 |
| Poll fallback | Task 11 |
| Product events | Task 6 |
| Chat Wave 2 deferred | Wave 2 preview |
| Env vars | Task 2 |
| Security (auth route, inbox private) | Task 4 |

No TBD placeholders. Room/event names consistent across tasks.
