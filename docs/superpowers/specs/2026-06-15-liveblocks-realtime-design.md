# Sense — Liveblocks realtime layer

**Status:** Approved — implementation plan ready (2026-06-15)  
**Date:** 2026-06-15  
**Topic:** Managed realtime (presence, collaborative lists, hybrid social push, chat migration) on Vercel  
**Parent:** [`2026-05-29-sense-product-roadmap-design.md`](./2026-05-29-sense-product-roadmap-design.md), [`sense-media-platform-strategy.md`](../../../sense-media-platform-strategy.md) (habit loop, social proof, Tier 3 collaborative lists)  
**Deferred:** Co-edited reviews (Yjs), staff Journal multiplayer editor, live Community Activity injection, Liveblocks Comments/Notifications products (Postgres migration)

## Summary

Sense is a strong **async** social product today. Realtime is fragmented: chat uses a custom Elysia WebSocket that **does not work on Vercel**; the notification bell **polls every 30s**; comments and reactions require navigation or manual refresh; collaborative lists have Postgres permissions but **no live co-editing**.

This spec adds **Liveblocks** as a Vercel-native realtime layer while **Postgres (`@still/db`) remains the source of truth** for all durable data. Wave 1 makes the app feel **alive** (viewing presence), **shared** (collaborative list reorder), and **responsive** (instant comments, reactions, notifications). Wave 2 replaces broken chat WebSockets with Liveblocks. Wave 3 adds deeper co-creation (co-reviews, Journal).

**North star:** Patrons feel social echo **while they are still in the app** — not only when they return hours later.

## Problem

| Gap | Impact |
|-----|--------|
| No Vercel-compatible realtime transport | Chat broken in production; team avoids WebSockets on web |
| Notification bell polls | Social feedback feels delayed; bell badge lags up to 30s |
| Comments/reactions are pull-only | Review threads feel dead while open; engagement loop breaks |
| Collaborative lists are REST-only | Two curators can conflict; no “building together” moment |
| No “who’s here” on titles | Movie/TV detail lacks lightweight FOMO and mutual-follow magic |

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Product pillars | **A + B + C** — liveness, co-creation, instant social feedback |
| Presence privacy | **Anonymous aggregate** (“3 patrons viewing”) + **mutual-follow names** (Wave 1 “friends” = mutual follow until a dedicated friends model ships) |
| Co-creation Wave 1 | **Collaborative lists** — live reorder + editor presence |
| Social feedback | **Hybrid** — Postgres writes; Liveblocks `broadcastEvent` to open clients |
| Chat | **Wave 2+** on Liveblocks; retire `apps/server/src/ws/*` after parity |
| Architecture | **Approach 1 — Unified Liveblocks layer** (not self-hosted pub/sub; not Liveblocks Comments migration) |
| Signed-out | No presence UI; no inbox room |
| Detail presence threshold | Hide row when count ≤ 1 (only viewer is self) |

## Approaches considered

### 1. Unified Liveblocks layer (chosen)

Rooms per surface; Presence for viewing/editing; Storage (LiveList) for collaborative list order during sessions; broadcast after Elysia DB commits; auth via Next.js + Better Auth.

**Pros:** Vercel-native; one vendor; natural chat migration; CRDT list order.  
**Cons:** New cost; disciplined Postgres flush required.

### 2. Presence-only first, defer Storage

Wave 1 = presence + broadcast only; list reorder stays REST optimistic UI.

**Pros:** Smaller first PR.  
**Cons:** Weak co-creation; editors can still clobber each other. **Rejected** — pillar B requires Storage in Wave 1.

### 3. Self-hosted realtime (Redis / Ably / custom WS fleet)

Replace `ws/hub.ts` with managed pub/sub; keep all logic custom.

**Pros:** Full control.  
**Cons:** Rebuilds Liveblocks; highest eng cost; still awkward on Vercel web. **Rejected.**

## Architecture

### Principle: Postgres authoritative, Liveblocks ephemeral + sync

| Data | Source of truth | Liveblocks role |
|------|-----------------|-----------------|
| Diary logs, reviews, lists, comments | **Postgres** | Broadcast after write |
| List item order (while editing) | **Postgres** on save | **LiveList** live order during session |
| “Who’s viewing” | Ephemeral | **Presence** only |
| Chat messages (Wave 2) | **Postgres** (`chat_message`) | Room delivery |
| Notifications | **Postgres** (`notification`) | Push to private inbox room |

Never treat Liveblocks Storage as the long-term canonical list. Always **debounce-flush** to existing `POST /api/lists/:id/reorder`.

### Room naming convention

```
listing:movie:{tmdbId}     — presence only; signed-in read + presence write
listing:tv:{tmdbId}        — presence only
list:{listId}              — presence + Storage; owner/collaborator write
review:{reviewId}          — broadcast channel (comments/reactions)
user:{userId}:inbox        — private; notification + social echo events
chat:{threadId}            — Wave 2; DM/group delivery
```

### Auth flow

1. Client calls `POST /api/liveblocks-auth` (Next.js App Router, Better Auth session).
2. Server mints Liveblocks session with **per-room permissions**:
   - **Listing rooms:** any signed-in user → read + presence write.
   - **List rooms:** `canEditList` → write; public visitors → read-only if `canViewList`.
   - **Inbox room:** only `session.user.id === userId` in room id.
   - **Review rooms:** read if review is visible to viewer (same rules as `GET` comments).
3. Elysia mutation handlers call `@liveblocks/node` **`broadcastEvent`** after successful DB commit (via `apps/server/src/lib/liveblocks-broadcast.ts`).

Rate-limit auth endpoint: **60 requests/minute per user**.

### Presence UX (movie / TV detail)

**Placement:** Compact row under `MovieDetailCommunityRatingHero` `variant="compact"` — same editorial band as community score.

**Copy & rules:**

- `{n} patrons viewing` — count excludes self; no names for non-mutuals.
- Mutual follows in room → up to **3** `PatronPortraitAvatar` chips + `@handle` links; then `+N`.
- Hidden when `n < 1` after excluding self (only you on the page).
- Signed-out: do not join room; no UI.

**Client filter for names:** Server includes presence user ids; client resolves mutual-follow set (existing follow graph) to decide which names to reveal. Strangers never see each other’s handles.

**Chrome:** `text-muted-foreground` `text-sm`; flat surfaces; no borders/rings; `useSoftwareGpuRendering` — no `backdrop-blur` on chip.

### Collaborative lists (Wave 1 co-creation)

When owner/collaborator opens `/lists/[id]`:

1. Enter `list:{listId}` room.
2. Hydrate **LiveList** from `GET /api/lists/:id` item order.
3. Drag in `RankedListReorderGrid` updates LiveList for all editors instantly.
4. **Debounce flush** (500ms idle) → `POST /api/lists/:id/reorder` (existing API).
5. Presence bar: `You and @handle are editing` (or solo `You’re editing`).
6. Public visitors: read-only `N curators editing` without stranger names.

**Favorites system list:** Same path — ranked favorites already support owner reorder; collaborators uncommon but permitted by existing permissions.

**Conflict rule:** On flush failure, **Postgres wins**. Reset LiveList to last committed server order. Toast: `Order couldn’t sync — refreshed from last save.`

On room enter: always re-hydrate from Postgres (handles “changed while away”).

### Hybrid instant feedback (pillar C)

After Elysia creates comment, reaction, or notification:

```text
DB commit → broadcastEvent(room, payload) → subscribed clients patch local state
```

| Room | Events |
|------|--------|
| `review:{reviewId}` | `comment.created`, `reaction.updated` |
| `user:{userId}:inbox` | `notification.created` |

**Review reader (`ReviewDetailSheet`):** `CommentsThread` appends on `comment.created`; `ReactionsBar` patches counts. If scrolled up, show **New** pill on thread header — tap scrolls to latest.

**Notification bell (`HomeNotificationsMenu`):** Subscribe to inbox room when authenticated. Remove 30s poll while Liveblocks connected; **retain poll as fallback** on disconnect/tab offline.

Existing `notification-preferences.ts`, `content_visibility`, and write-path permission checks are unchanged.

### Broadcast payload contracts (minimal)

Clients refetch or patch by id — never trust broadcast body for auth-sensitive fields.

```ts
// review:{reviewId}
{ type: "comment.created"; commentId: string; preview: string }
{ type: "reaction.updated"; likesCount: number; dislikesCount: number }

// user:{userId}:inbox
{ type: "notification.created"; notificationId: string; kind: string }

// list:{listId} (optional)
{ type: "list.metadata.updated" }
```

### Chat (Wave 2)

**Context:** `/chat` exists but custom `ws/hub.ts` + Elysia `/ws/chat` do not work on Vercel production.

1. Keep `chat_thread`, `chat_message`, `chat_member` tables.
2. `POST` message → DB insert → `broadcastEvent` to `chat:{threadId}`.
3. `/chat` UI uses `@liveblocks/react` instead of `new WebSocket()`.
4. Typing via presence field `isTyping`.
5. Delete `apps/server/src/ws/*` after parity checklist (threads list, send, typing, notifications `chat.message`).

### Package layout

```
packages/liveblocks/
  src/room-ids.ts           # builders + parsers
  src/event-types.ts        # discriminated union for broadcast payloads
  src/permissions.ts        # room access helpers (used by auth route + server)

apps/web/
  src/app/api/liveblocks-auth/route.ts
  src/components/realtime/liveblocks-provider.tsx
  src/components/realtime/listing-presence-row.tsx
  src/components/realtime/list-collab-room.tsx

apps/server/src/lib/liveblocks-broadcast.ts
```

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `LIVEBLOCKS_SECRET_KEY` | Server only (Next auth route + Elysia) | Mint sessions, broadcast |
| `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` | Web client | Liveblocks client init |

## UI surfaces by wave

### Wave 0 — Prerequisites

- Liveblocks project + env in Vercel
- `LiveblocksProvider` in `(app)` layout (signed-in only)
- Auth route + permission tests
- `product_event` kinds (see Instrumentation)

### Wave 1 — “The app feels alive”

| Surface | Feature |
|---------|---------|
| `/movies/[id]`, `/tv/[id]` | Viewing presence row |
| `/lists/[id]` (editor) | LiveList reorder + editor presence |
| Review reader / carousel | Live comments + reactions |
| `HomeNotificationsMenu` | Push inbox; poll fallback |

**Explicitly not Wave 1:** `/home` grid presence, profile filmography presence, Community Activity live rows.

### Wave 2 — “Chat that works”

| Surface | Feature |
|---------|---------|
| `/chat` | Liveblocks delivery + typing |
| Server | Retire WebSocket hub |

### Wave 3 — Deeper co-creation

| Surface | Feature |
|---------|---------|
| Review composer | Co-edited reviews (Liveblocks Yjs + Tiptap/BlockNote) |
| `/journal` | Staff multiplayer editor |
| `/home` `browse=community` | Optional Activity pulse rows |

## Addictiveness mechanics (strategy-aligned)

| Mechanic | Realtime hook | Guardrail |
|----------|---------------|-----------|
| Personal social proof | Mutual follow on same title | Strangers anonymous only |
| Variable reward | Bell + in-thread comment while reading | No sound on likes; respect notification prefs |
| Zeigarnik / return | Co-editing list with friend | Flush errors inline + retry |
| Endowment | Re-hydrate list from Postgres on enter | No blind overwrite |
| Light FOMO | “3 patrons viewing” | Hide when alone; no push for “X is viewing” |

## Offline, errors & disconnect

| State | Behavior |
|-------|----------|
| Liveblocks disconnected | Hide presence row; bell uses 30s poll fallback |
| Reconnect | Re-enter rooms; list room re-hydrates from Postgres |
| Flush failure | Revert LiveList; toast; `realtime.list.sync_conflict` event |
| Tab backgrounded | Stay subscribed (Liveblocks default); optional 60s presence idle clear in Phase 1.1 |

## Security

- Session cookies only on web auth route — never expose secret key to client.
- Room permissions computed server-side (`canEditList`, `canViewList`, review visibility).
- Private list titles never in public room metadata.
- Broadcast payloads are **hints** — clients verify via existing APIs when needed.

## Instrumentation

Register `product_event` kinds (migration if needed):

- `realtime.presence.join` / `realtime.presence.leave` — props: `surface` (`movie` \| `tv` \| `list`)
- `realtime.list.coedit` — props: `collaboratorCount`
- `realtime.comment.received_live`
- `realtime.notification.push_received`
- `realtime.list.sync_conflict`

## Testing

| Layer | Coverage |
|-------|----------|
| Unit | Room ID builders, permission matrix, event payload parsers |
| Server | `liveblocks-broadcast` called after comment/reorder/notification insert |
| Web | `listing-presence-row` mutual-follow name filter; list debounce flush |
| Manual QA | Two browsers co-editing ranked list; two mutual follows on same detail; bell without poll when connected |

## Rollout waves (summary)

```text
Wave 0 — Liveblocks auth, provider, env, events
Wave 1 — Detail presence, collab lists, hybrid comments/reactions/notifications
Wave 2 — Chat on Liveblocks; delete apps/server/src/ws/*
Wave 3 — Co-reviews (Yjs), Journal editor, optional live Activity
```

## Out of scope

- Liveblocks Comments product (migrate off Postgres comments)
- Liveblocks Notifications product (migrate off Postgres notifications)
- Live cursors on movie detail pages
- “X is viewing” push notifications
- Replacing Postgres as source of truth for any durable patron data

## References

- Existing chat (broken WS): `apps/server/src/ws/hub.ts`, `apps/web/src/components/chat/chat-pane.tsx`
- Notification poll: `apps/web/src/components/home/home-notifications-menu.tsx` (`NOTIFICATIONS_POLL_INTERVAL_MS = 30_000`)
- List reorder API: `apps/server/src/routes/lists.ts` `POST /:id/reorder`
- Collaborative list model: `packages/db/src/schema/list.ts` (`list_collaborator`, `is_collaborative`)
- Strategy psych triggers: `sense-media-platform-strategy.md` Section 10
