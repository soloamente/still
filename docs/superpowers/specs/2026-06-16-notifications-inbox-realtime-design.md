# Sense — Global notifications inbox (realtime badge)

**Status:** Approved (2026-06-16) — brainstorm locked  
**Date:** 2026-06-16  
**Topic:** Notifiche inbox che si aggiornano in realtime su tutte le superfici nav — provider globale + SSE + poll di sicurezza  
**Parent:** [`2026-06-15-sense-realtime-redis-sse-design.md`](./2026-06-15-sense-realtime-redis-sse-design.md) Wave 1 (inbox bell)

## Summary

Patrons today only see new notifications after **opening** the bell dropdown (or navigating to `/notifications`). The unread dot does not update live on lobby pages; detail, profile, and settings pages have **no bell at all** on desktop. Root cause: inbox fetch state lives inside `HomeNotificationsMenu` (mounted only in `HomeStickyChrome`), while `InboxRealtimeSubscriber` in the app layout emits SSE invalidations with **no global consumer**. When SSE reports `connected`, the 30s poll stops — if the push path fails (common in local dev when Upstash is set on the server but not on Next), the bell stays stale until manual open.

**Fix:** a **`NotificationsInboxProvider`** in `(app)` layout owns inbox rows, `unreadCount`, fetch, SSE invalidation, and a **slow safety poll** that never stops while the tab is visible. All nav surfaces read from one hook; no surface owns fetch logic.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Approach | **A — Global inbox provider** (not poll-only patch, not floating AppShell bell duplicate) |
| Surfaces | `HomeNotificationsMenu`, `MobileTabBar` Inbox, `/notifications`, `MovieDetailTopBar`, `ProfileTopBar` |
| Transport | Existing SSE `notification.created` on `user:{userId}:inbox` + **60s poll always** (tab visible) |
| SSE down | Poll continues; no reliance on `realtimeConnected` to gate polling |
| Optimistic prepend | **No** — refetch `GET /api/notifications` on push (same as today, centralized) |
| Toast / Web Push | **Out of scope** |
| Env | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` on **both** `apps/server` and `apps/web` (document in plan) |

## Problem

### Observed behavior (locale + produzione)

1. On `/home`, diary, watchlist, lists: bell visible but **orange unread dot does not appear** until the dropdown is opened.
2. On movie/TV detail, profile, settings: **no notification affordance** on desktop; patron discovers notifications only after navigating away.
3. Mobile tab **Inbox** (`/notifications`) is a static RSC fetch — list does not live-update.

### Why opening the menu “fixes” it

`HomeNotificationsMenu.handleMenuOpenChange` calls `refreshInbox()` on open. That is the only reliable path when SSE push does not reach the component or the component is unmounted.

### Technical gaps

```text
Today:
  deliverNotification → publishRealtimeEvent(user:{id}:inbox)
  InboxRealtimeSubscriber (layout) → emitNotificationsInboxLive()
  HomeNotificationsMenu (HomeStickyChrome only) → subscribeNotificationsInboxLive → fetch

Gaps:
  • Pub/sub has a single subscriber tied to lobby chrome
  • realtimeConnected=true disables poll → silent failure if push broken
  • Local dev: server may publish to Upstash while Next SSE uses in-process dev bus
  • /notifications and MobileTabBar have no live wiring
```

## Architecture

```text
(app)/layout.tsx
  RealtimeRootProvider
    InboxRealtimeSubscriber          // unchanged: SSE → invalidate
    NotificationsInboxProvider     // NEW: single source of truth
      PatronActivityProvider …
        children

NotificationsInboxProvider
  on mount (authenticated):
    • initial GET /api/notifications?limit=80
    • subscribeNotificationsInboxLive → refetch (or inline invalidate callback)
    • setInterval 60s while document.visibilityState === visible
    • visibilitychange → refetch when tab foregrounded
  exposes useNotificationsInbox():
    { rows, unreadCount, loading, refresh, markOneRead, markAllRead }

UI consumers (read-only + actions):
  HomeNotificationsMenu      → dropdown panel
  NotificationsBellCompact   → shared icon + dot (detail/profile top bars)
  MobileTabBar Inbox link    → unread dot overlay
  NotificationsListLive      → client wrapper on /notifications page
```

**Deprecate** fetch/poll/subscribe logic inside `HomeNotificationsMenu`. Keep `notifications-inbox-live.ts` as the internal bridge between `InboxRealtimeSubscriber` and the provider (or fold emit into provider via ref callback — prefer **one** invalidation path).

### Hybrid transport

| Signal | Action |
|--------|--------|
| SSE `notification.created` | `refresh()` immediately (tab visible) |
| Poll every **60s** | `refresh()` while tab visible — **always**, regardless of `realtimeConnected` |
| `visibilitychange` → visible | `refresh()` + ensure poll running |
| Menu open | `refresh()` (explicit, as today) |

Do **not** stop poll when SSE connects. Optionally log SSE connected state for diagnostics only.

### Unread count

`unreadCount = rows.filter(r => !r.readAt).length` derived from provider state (same semantics as `hasUnread` today). Exposed to `MobileTabBar` and compact bells.

## UI surfaces

### `HomeNotificationsMenu`

- Consumes `useNotificationsInbox()`.
- Renders existing dropdown; no local `useEffect` fetch.
- `markOneRead` / `markAllRead` update provider state optimistically (move logic from component or call provider methods).

### `NotificationsBellCompact` (new)

- Props: `className?`, `iconSize?` — matches detail top bar press targets.
- Renders bell icon + orange dot when `unreadCount > 0`.
- Wraps same `DropdownMenu` + `NotificationsDropdownPanel` as lobby bell **or** links to `/notifications` on mobile-narrow — **prefer same dropdown** for parity.
- Mount in:
  - `MovieDetailTopBar` (trailing actions, before Share)
  - `ProfileTopBar` (trailing cluster)

Do **not** add a second bell on routes that already render `HomeStickyChrome`.

### `MobileTabBar`

- Read `unreadCount` from context.
- Orange dot on Inbox icon (same token as lobby: `bg-desert-orange`, `ring-background`).

### `/notifications` page

- Replace static-only render with client `NotificationsListLive`:
  - Initial `items` from RSC props (first paint).
  - Subscribe to provider or call `refresh` on live invalidation.
  - Provider remains authoritative when signed in on `(app)` routes.

## Env and dev parity

| Variable | Server (Elysia) | Web (Next SSE) |
|----------|-----------------|----------------|
| `UPSTASH_REDIS_REST_URL` | publish `XADD` | `XREAD` in `/api/realtime/stream` |
| `UPSTASH_REDIS_REST_TOKEN` | publish | subscribe |

**Rule:** both apps must share the same Upstash project in every environment. If only the server has keys, local SSE connects via dev bus while publishes go to Redis — **connected but zero events**.

**Mitigation in code:** safety poll (60s) masks split-brain; **mitigation in ops:** copy keys to `apps/web/.env.local` and Vercel web project.

## Error handling

- Fetch failure: keep last good `rows`; do not clear badge on transient error.
- Provider unmount (sign-out): reset rows to `[]`, `unreadCount` 0.
- SSE malformed events: ignored (existing behavior).
- `InboxRealtimeSubscriber` stays fail-open — notification delivery never blocks on realtime.

## Testing

| Test | Assertion |
|------|-----------|
| `notifications-inbox-provider.test.ts` | SSE invalidate triggers refetch; poll interval registered; poll not cleared when `connected` flips true |
| `notifications-inbox-live` (existing) | bridge still fans out to provider listener |
| `home-notifications-menu` (optional shallow) | renders dot when provider has unread |
| Manual | Follow/comment from second account → dot on `/home`, movie detail, profile, mobile Inbox **without** opening dropdown |

## Out of scope

- Browser / OS push notifications
- Per-notification toast
- Staff-only notification surfaces
- Bell on public share routes (`/movies/[id]` unsigned)

## Success criteria

1. New notification while on `/home`: orange dot within **2s** (SSE) or **60s** (poll worst case) without opening menu.
2. Same while on movie detail or profile: compact bell shows dot.
3. Mobile Inbox tab shows dot; `/notifications` list updates without full page navigation.
4. Local dev works with Upstash on both processes, or degrades to 60s poll without requiring menu open.

## Files (implementation hint)

| Action | Path |
|--------|------|
| Create | `apps/web/src/components/notifications/notifications-inbox-provider.tsx` |
| Create | `apps/web/src/components/notifications/notifications-bell-compact.tsx` |
| Create | `apps/web/src/components/notifications/notifications-list-live.tsx` |
| Modify | `apps/web/src/app/(app)/layout.tsx` — wrap provider |
| Modify | `apps/web/src/components/home/home-notifications-menu.tsx` — consumer only |
| Modify | `apps/web/src/components/app/mobile-tab-bar.tsx` — unread dot |
| Modify | `apps/web/src/components/movie/movie-detail-top-bar.tsx` — compact bell |
| Modify | `apps/web/src/components/profile/profile-top-bar.tsx` — compact bell |
| Modify | `apps/web/src/app/(app)/notifications/page.tsx` — live list |
| Test | `apps/web/src/components/notifications/notifications-inbox-provider.test.ts` |

**Next step:** implementation plan via `writing-plans` skill → `docs/superpowers/plans/2026-06-16-notifications-inbox-realtime.md`.
