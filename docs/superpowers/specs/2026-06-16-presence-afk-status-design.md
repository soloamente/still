# Sense — Presence AFK status (orange dot)

**Status:** Approved (2026-06-16) — brainstorm locked  
**Date:** 2026-06-16  
**Topic:** Away (AFK) state for global online presence badges  
**Parent:** [`2026-06-16-presence-online-visibility-design.md`](./2026-06-16-presence-online-visibility-design.md)

## Summary

Extend the shipped **online-now green dot** so patrons who are still connected but inactive show an **orange away badge** instead. AFK is **user-global** (not per-room): the same state drives every `PatronOnlineDot` surface — feed, profile, leaderboards, listing presence row/drawer, and any other portrait that registers online status.

Transport reuses the existing **heartbeat** (`POST /api/realtime/presence`) with an additive `activityState` field. No second activity endpoint.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| AFK triggers | **Tab hidden** (`document.hidden`) **OR** no user input for **≥ 5 minutes** |
| Tab hidden | Immediate `away` (no debounce) |
| Inactivity window | **5 minutes** |
| Surfaces | **All** `PatronOnlineDot` usages globally |
| Architecture | **Approach 1** — `activityState` on existing heartbeat |
| Active color | Green (`bg-emerald-400`) — unchanged |
| Away color | Orange Sense accent (`bg-desert-orange` / `#f97316`) |
| Offline | No dot — heartbeat stale (>45s) unchanged |
| Privacy | Same `preferences.privacy.presenceVisibility` (`friends` \| `public`) |
| Motion | Pop on mount/unmount **and** micro-pop on `active` ↔ `away` color change |
| Reduced motion | Instant color swap only — no scale/blur |

## Problem

The green dot only communicates **online now**. Patrons who leave a tab open on Sense but switch away or stop interacting look equally “active” as someone reading and scrolling. An **away** state adds nuance without exposing last-seen timestamps or a full presence product.

This supersedes the prior “online only” lock in the parent spec’s out-of-scope list for idle/away — **away** is in scope; **last-seen** and push notifications remain out of scope.

## AFK logic (client)

### Inputs tracked

Throttle activity pings to at most once per **30 seconds** unless a state transition fires immediately.

| Event | Effect |
|-------|--------|
| `mousemove`, `pointerdown`, `keydown`, `scroll`, `touchstart` | Refresh `lastInputAt` |
| `visibilitychange` → hidden | Set `away` immediately |
| `visibilitychange` → visible | Recompute: `away` only if `now - lastInputAt ≥ 5 min` |
| Timer (every 30s) | Recompute away from `lastInputAt` + visibility |

### Derived state

```ts
const isAway =
  document.hidden || Date.now() - lastInputAt >= 5 * 60 * 1000;

const activityState: "active" | "away" = isAway ? "away" : "active";
```

### Heartbeat cadence

| When | Action |
|------|--------|
| Every **25s** (existing interval) | `POST` with `{ room, activityState }` for app + listing rooms as today |
| On `activityState` flip | Immediate `POST` (do not wait for interval) |
| On unmount / `pagehide` | `DELETE` unchanged |

**Module:** shared `usePatronActivityTracker()` (or equivalent) consumed by `PatronOnlineProvider` and `ListingPresenceProvider` so listing + global heartbeats share one source of truth.

## Architecture

```text
Client activity tracker
  → activityState: active | away
  → POST /api/realtime/presence { room, activityState }
      (patron app room + listing room when on title detail)

Elysia touch handler
  → ZADD sense:presence:{roomId}  (unchanged)
  → HSET sense:presence:activity  field=userId  value=active|away
  → EXPIRE activity hash member TTL aligned with presence stale window
  → publish presence.updated when occupancy changes (unchanged)

GET /api/realtime/presence/online?handles=...
  → join ZSET membership + activity hash + privacy filters
  → return presence rows with state

GET /api/realtime/presence?room=listing:...
  → viewingPatrons include presenceState per row
```

### Redis

| Key | Purpose |
|-----|---------|
| `sense:presence:{roomId}` | Existing ZSET — heartbeat scores (unchanged) |
| `sense:presence:activity` | HASH — `userId` → `"active"` \| `"away"` |

**Rules:**

- Set activity hash on every successful `touch` when `activityState` is provided.
- Remove hash field on `leave` / stale prune when user drops out of all presence rooms (or set TTL per field ~60s refreshed on touch).
- Missing hash field for an active ZSET member → treat as **`active`** (backward compatible).

## API contracts

### `POST /api/realtime/presence` (extended body)

```ts
{
  room: string;
  activityState?: "active" | "away";  // default "active" when omitted
}
```

- Validation: `activityState` must be `"active"` or `"away"` when present.
- Rate limit unchanged (6/min per user).
- Both `patron:app` and listing rooms accept the field; **activity is stored per userId**, not per room, so the latest heartbeat wins globally.

### `GET /api/realtime/presence/online?handles=a,b,c` (extended response)

Replace bare handle list with explicit state (breaking additive — clients updated in same PR):

```ts
{
  presence: Array<{
    handle: string;           // lowercase normalized
    state: "active" | "away";
  }>;
}
```

- Only handles the viewer is allowed to see (existing privacy + mutual/public rules).
- Handles not online are omitted (not returned as offline).

### `GET /api/realtime/presence?room=listing:movie:{id}` (extended patron rows)

```ts
viewingPatrons: Array<{
  // ...existing fields...
  presenceState: "active" | "away";  // replaces isOnlineNow: true
}>;
```

Remove `isOnlineNow: true` literal — consumers use `presenceState`.

## UI design

### `PatronOnlineDot`

| `presenceState` | Visual | `aria-label` |
|-----------------|--------|--------------|
| `active` | Green dot | `@handle online now` |
| `away` | Orange dot | `@handle away` |
| offline / hidden | No dot | — |

**Props (target shape):**

```ts
{
  presenceState: "active" | "away" | null;
  size?: PatronOnlineDotSize;
}
```

`visible` becomes `presenceState != null`.

### Motion (`motion/react`)

| Transition | Animation |
|------------|-----------|
| `null` → dot | Existing entrance: `opacity 0 → 1`, `scale 0.25 → 1`, blur out, spring ~300ms |
| dot → `null` | Existing exit (inverse) |
| `active` ↔ `away` | **Same element** — color crossfade + micro-pop `scale 1 → 1.12 → 1` (~180ms, spring, `bounce: 0`) |
| `prefers-reduced-motion` | Instant color change, no scale/blur |

Use a stable `motion.span` key for the dot shell; drive color via `animate` / `className` swap on `presenceState` change so mount pop and state pop do not fight.

### `PatronPortraitWithMetalTier`

- `usePatronOnlineStatus` → `usePatronPresenceState(handle)` returning `"active" | "away" | null`.
- Pass state into `PatronOnlineDot`.

### Listing presence

- Enable `showOnlineStatus` on compact row avatars and drawer rows (parent spec intent).
- Dot color follows each patron’s `presenceState` from GET snapshot.

## Error handling and fallbacks

| Case | Behavior |
|------|----------|
| Missing `activityState` on POST | Server stores `active` |
| Missing hash field on read | `active` |
| Redis unavailable (dev bus) | Client still tracks locally; batch read returns `active` only for online handles until server path exists |
| SSE/poll lag | Remote viewers may see state up to ~20–25s late; local viewer’s own tracker is immediate |
| Privacy deny | Patron omitted from `presence` array — same as today for identity |

## Testing

### Server unit tests

- `touch` writes activity hash `active` / `away`
- `leave` clears activity field
- `GET /online` returns `state: "away"` when hash says away
- Missing hash → `active`
- Privacy filters unchanged — stranger cannot see `away` when `friends` only

### Web unit tests

- `PatronOnlineDot` renders green vs orange class per state
- SR labels `online now` vs `away`
- Activity tracker: hidden doc → away; 5 min idle → away; input resets active
- Reduced motion: no scale animation on state change (mock hook)

### Manual QA

1. Two browsers — patron A switches tab away → patron B sees orange on A’s avatars within one heartbeat + immediate push.
2. Patron A idle 5 min on visible tab → orange for B.
3. Patron A moves mouse → green with micro-pop.
4. `friends` privacy — stranger does not see dot; friend sees orange/green.
5. Listing presence corner pill + drawer show matching dot colors.

## Out of scope

- Last-seen timestamps or “idle 3m ago” copy
- User setting to disable away detection
- Push notifications for away/active
- Away state on signed-out surfaces
- Staff/admin presence dashboard

## Relationship to parent spec

[`2026-06-16-presence-online-visibility-design.md`](./2026-06-16-presence-online-visibility-design.md) remains authoritative for **privacy** and **surfaces**. This spec adds the **away** sub-state and **orange** badge + motion. Update parent doc’s “Out of scope — idle/away” note to point here when implementing.
