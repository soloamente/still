# Listing Presence (Movie / TV Detail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show “N patrons viewing” with mutual-follow chips on movie and TV detail using Redis heartbeats and hybrid SSE + poll — no Liveblocks.

**Architecture:** Elysia `POST`/`DELETE` touch a per-room Redis ZSET (`sense:presence:{roomId}`); `GET` returns server-filtered `{ viewerCount, mutualPatrons }`. Count changes publish `presence.updated` on the existing listing SSE room. Client heartbeat ~25s, poll ~20s when SSE disconnected.

**Tech Stack:** `@still/realtime`, `@upstash/redis`, Elysia, Next.js client components, `bun:test`.

**Spec:** [`docs/superpowers/specs/2026-06-16-listing-presence-design.md`](../specs/2026-06-16-listing-presence-design.md)

---

## Conventions

- Presence Redis key: `sense:presence:{roomId}` (ZSET; member = `userId`, score = heartbeat ms)
- Stale threshold: **45s** — prune on every touch
- Heartbeat interval: **25s**; poll fallback: **20s** when `!realtime.connected`
- SSE event: `{ type: "presence.updated", viewerCount: number }` (excludes self)
- Tests: `bun:test`; human **`go`** between tasks
- Do **not** commit unless the human asks

---

## Task 1: Event type + Redis helpers

**Files:**
- Modify: `packages/realtime/src/event-types.ts`
- Modify: `packages/realtime/src/event-types.test.ts`
- Create: `apps/server/src/lib/listing-presence.ts`
- Create: `apps/server/src/lib/listing-presence.test.ts`

- [ ] **Step 1:** Add `presence.updated` schema `{ type, viewerCount }` to `@still/realtime`
- [ ] **Step 2:** Implement `presenceRedisKey(roomId)`, `touchListingPresence`, `leaveListingPresence`, `pruneStalePresence`, `countListingPresence`, `activeListingPresenceUserIds`
- [ ] **Step 3:** Tests — touch/leave/prune/count; empty room returns 0
- [ ] **Step 4:** Run `cd packages/realtime && bun test` and `cd apps/server && bun test src/lib/listing-presence.test.ts`

**Success criteria:** Event parser test passes; ZSET logic covered without Redis (inject mock client).

---

## Task 2: Mutual-follow snapshot query

**Files:**
- Modify: `apps/server/src/lib/listing-presence.ts`
- Modify: `apps/server/src/lib/listing-presence.test.ts`

- [ ] **Step 1:** `fetchMutualPatronsInRoom(viewerId, activeUserIds)` — query `follow` where `followerId = viewer`, `isMutual = true`, `followingId IN active`, join `profile` (handle, displayName, image, prefs for animated + metal tier)
- [ ] **Step 2:** `getListingPresenceSnapshot(viewerId, roomId)` → `{ viewerCount, mutualPatrons }` (cap mutual array at 8 for `+N` math)
- [ ] **Step 3:** Unit test with mocked db rows

**Success criteria:** Viewer excluded from count; only mutual rows returned.

---

## Task 3: Elysia routes

**Files:**
- Create: `apps/server/src/routes/realtime-presence.ts`
- Create: `apps/server/src/routes/realtime-presence.test.ts`
- Modify: `apps/server/src/index.ts` (or route mount file)

- [ ] **Step 1:** `POST /api/realtime/presence` — validate listing room, rate-limit, touch, publish on count change
- [ ] **Step 2:** `DELETE /api/realtime/presence` — leave + publish on change
- [ ] **Step 3:** `GET /api/realtime/presence?room=` — snapshot for viewer
- [ ] **Step 4:** Route tests (401 unsigned, 403 bad room, happy path with mocked Redis + db)

**Success criteria:** `bun test src/routes/realtime-presence.test.ts` passes.

---

## Task 4: Web fetch + hook

**Files:**
- Create: `apps/web/src/lib/fetch-listing-presence.ts`
- Create: `apps/web/src/hooks/use-listing-presence.ts`
- Create: `apps/web/src/lib/listing-presence-copy.ts` (pluralization helper + tests)

- [ ] **Step 1:** Typed Eden/fetch wrappers for GET + POST + DELETE presence
- [ ] **Step 2:** `useListingPresence({ roomId, listingKind, listingId })` — heartbeat interval, leave on unmount (`sendBeacon` fallback), `useRegisterRealtimeRoom`, `useRealtimeSubscription` for `presence.updated`, poll when disconnected, emit `realtime.presence.join` / `.leave` product events
- [ ] **Step 3:** Copy helper tests (`1 patron viewing` vs `3 patrons viewing`)

**Success criteria:** Hook compiles; copy tests pass.

---

## Task 5: UI row + page wiring

**Files:**
- Create: `apps/web/src/components/movie/listing-presence-row.tsx`
- Create: `apps/web/src/components/realtime/listing-presence-provider.tsx`
- Modify: `apps/web/src/app/(app)/movies/[id]/page.tsx`
- Modify: `apps/web/src/app/(app)/tv/[id]/page.tsx`

- [ ] **Step 1:** `ListingPresenceRow` — hidden when `viewerCount === 0`; mutual chips (max 3) + `+N`; anonymous count line
- [ ] **Step 2:** Provider wraps row; passes snapshot from hook
- [ ] **Step 3:** Mount below `MovieDetailCommunityRatingHero variant="compact"` on movie + TV pages (signed-in shell only — pages already behind auth)
- [ ] **Step 4:** Visual check at `sm` and mobile widths

**Success criteria:** Row renders under community score; hidden when alone.

---

## Task 6: Verification + docs

**Files:**
- Modify: `.cursor/scratchpad.md`
- Modify: `AGENTS.md` (listing presence one-liner)
- Modify: `docs/superpowers/specs/2026-06-15-sense-realtime-redis-sse-design.md` — mark Phase B presence as specced separately

- [ ] **Step 1:** Run automated test bundle (realtime package, listing-presence lib + routes, web copy tests)
- [ ] **Step 2:** Manual QA — two sessions same `/movies/[id]`; mutual follow chip; close tab → count drops
- [ ] **Step 3:** Update scratchpad status

**Success criteria:** Tests green; manual QA signed off with human **`ok`**.

---

## Manual QA checklist

1. Open same movie in two signed-in browsers → `1 patron viewing`
2. Mutual follow in both → avatar + `@handle` visible
3. Non-mutual stranger → count only, no name leak
4. Close second tab → first tab returns to hidden or `0`
5. SSE off (block stream URL) → poll still updates within ~20s
6. Signed-out share shell (if tested) → no row (N/A for `(app)` routes)
