# Sense — Presence `/online` spike fix

**Status:** Approved (2026-07-02) — brainstorm locked  
**Date:** 2026-07-02  
**Topic:** Stop runaway client polling on `GET /api/realtime/presence/online`  
**Parent:** [`2026-06-16-presence-afk-status-design.md`](./2026-06-16-presence-afk-status-design.md), [`2026-06-15-sense-realtime-redis-sse-design.md`](./2026-06-15-sense-realtime-redis-sse-design.md)

## Summary

A single signed-in patron on `cinema.sense.fans` triggered **~28K edge requests in 14 minutes** (bursts up to **4,600 req / 20s**) to `GET /api/realtime/presence/online`. Root cause is a **client feedback loop** in `PatronOnlineProvider`: every `/online` response updates React state → context identity changes → portrait effects unregister/re-register handles → immediate `queueMicrotask` refetch → repeat.

Fix breaks the loop on the client and adds a **server rate limit** as defense-in-depth. Normal away/active UX is unchanged: self dot stays instant; others' dots remain SSE-driven with the existing **~10s** throttle ceiling.

## Incident (locked facts)

| Fact | Value |
|------|-------|
| Endpoint | `GET /api/realtime/presence/online` |
| Spike window | 18:35–18:47 UTC |
| Peak burst | ~4,600 requests / 20s from one IP |
| Share of spike | ~94% from `79.216.27.33` (Deutsche Telekom) |
| Referrer | `cinema.sense.fans` |
| Browsers | Opera + Chrome, Windows + Android |
| HTTP status | All 200 — server healthy, client abusive |
| Resolution | Traffic subsided when session ended (~18:50 UTC) |

## Root cause

```text
/online response
  → setPresenceByHandle(new Map)
  → getPresenceState callback identity changes
  → PatronOnlineContext value changes
  → usePatronPresenceState effects cleanup (delete handle from registry)
  → effects re-run registerHandle (handle treated as newly registered)
  → queueMicrotask(refreshOnlineHandles) per handle
  → concurrent /online storms (no in-flight dedupe)
  → loop
```

Feed-heavy routes (Community Activity, leaderboards, comments) amplify the loop: dozens of `PatronPortraitWithMetalTier` instances re-register per cycle.

**Contributing factors (not sufficient alone):**

- Heartbeat success also calls `refreshOnlineHandles` (~every 25s) — redundant with poll + SSE.
- `queueMicrotask` immediate fetch on every *new* handle registration — fine on mount, catastrophic inside a loop.
- GET `/online` has **no** server rate limit (POST heartbeats are limited to 30/min).

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Approach | **B** — client loop fix + server safety net (no SSE payload push in this change) |
| Self dot latency | **Unchanged** — local `aggregateActivityState` |
| Others' dot latency | **Unchanged** — SSE `presence.updated` + **10s** client throttle + **30s** poll fallback |
| Server rate limit | **12 requests / minute / user** on `GET /online` → `429` |
| Client on 429 | Keep last snapshot; retry on next scheduled refresh (no toast) |
| In-flight dedupe | **One** `/online` fetch per session at a time |
| State updates | Shallow-compare snapshot before `setPresenceByHandle` |
| Context stability | Presence map in `useRef`; context callbacks stable across snapshot updates |
| Heartbeat → refresh | **Remove** — SSE + poll cover mirror updates |
| Registration refresh | Keep 200ms debounce; remove per-handle `queueMicrotask` storm (single coalesced refresh) |

## Client architecture (after fix)

### Stable context

- `presenceByHandleRef` holds the latest `Map`; `getPresenceState` reads the ref (stable callback).
- `presenceVersion` state (or equivalent) bumps only when snapshot **content** changes so subscribed portraits re-render without context identity churn.
- `registerHandle` / `isOnline` / `viewerHandle` remain stable across routine presence updates.

### Refresh scheduler

Single `refreshOnlineHandles` implementation with:

1. **In-flight guard** — if a fetch is active, set `pendingRefresh` flag; run once more after completion.
2. **Shallow compare** — skip `setState` when handle→state map is unchanged.
3. **Coalesced registration** — debounced 200ms batch only (no `queueMicrotask` per handle).

### Triggers (unchanged cadence, fixed behavior)

| Trigger | Interval | Notes |
|---------|----------|-------|
| SSE `presence.updated` | min 10s between fetches | existing throttle |
| Background poll | 30s | unchanged |
| Handle registration | 200ms debounce | coalesced |
| Heartbeat success | — | **removed** |

## Server architecture (after fix)

`GET /api/realtime/presence/online`:

```ts
hit(`presence-online:${user.id}`, { limit: 12, windowMs: 60_000 })
```

- Aligns with healthy client ceiling (~6 SSE + ~2 poll + headroom).
- Returns `429 Slow down` — same pattern as POST heartbeat limit.
- Does not change resolver logic or response shape.

## Error handling

| Case | Behavior |
|------|----------|
| `/online` network error | Keep last snapshot (existing) |
| `/online` 429 | Keep last snapshot; do not retry until next throttle/poll window |
| Abort on unmount | Existing `AbortController` |
| Empty handle batch | Skip fetch (existing) |

## Testing

### Client unit tests

- Snapshot shallow-equal helper skips redundant updates.
- Refresh scheduler coalesces concurrent calls into one in-flight request + optional trailing run.
- Context callback identities stable when presence ref updates with same content.

### Server route test

- `GET /online` returns 429 when rate limit exceeded (mirror POST test pattern).

### Manual

1. Sign in → open Community Activity with many avatars → Network tab: `/online` ≤ ~12/min, no sustained burst.
2. Toggle tab hidden/visible → self dot immediate; other dots update within ~10s.
3. Two tabs same account → each ≤ 12/min (no cross-tab sync required).

## Out of scope

- Pushing presence rows in SSE `presence.updated` payload (future optimization).
- Cross-tab refresh deduplication via `BroadcastChannel`.
- Changing presence visibility rules or AFK thresholds.
- Listing presence `GET /api/realtime/presence?room=` (separate endpoint; same throttle pattern deferred).

## Success criteria

- One patron on a feed-heavy route cannot exceed **~12 `/online` requests per minute** under normal or buggy re-render conditions.
- No regression in self-view dot immediacy.
- Others' away/active transitions still visible within **~10s** under SSE connectivity.
