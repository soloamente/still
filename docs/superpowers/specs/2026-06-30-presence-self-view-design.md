# Sense — Self presence dot (online / away)

**Status:** Approved (2026-06-30) — brainstorm locked  
**Date:** 2026-06-30  
**Topic:** Show the signed-in viewer their own online / away badge on portrait surfaces  
**Parent:** [`2026-06-16-presence-afk-status-design.md`](./2026-06-16-presence-afk-status-design.md), [`2026-06-16-listing-presence-design.md`](./2026-06-16-listing-presence-design.md)

## Summary

Today Sense hides the viewer's own presence dot everywhere — `PatronOnlineProvider` filters the viewer's handle out of batch lookups, and listing presence excludes the viewer from `viewingPatrons`. This spec adds **self-view**: the signed-in patron sees the same green (active) or orange (away) dot others see on them, driven by **server mirror state** (not local activity tracker), on every portrait surface including movie/TV listing presence.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Surfaces | **Everywhere** the viewer's portrait renders (account menu, profile, feed, leaderboards, etc.) **plus** listing presence corner stack on movie/TV detail |
| Alone on title | Show **avatar + dot only** — no “others viewing” count line until another patron joins |
| State source | **Server mirror** — same Redis activity + heartbeat path others use (~20–25s lag acceptable) |
| Screen reader (self) | **Second person** — “You are online now” / “You are away” |
| Architecture | **Approach 1** — extend existing `/online` batch + listing GET snapshot paths (no parallel self endpoint) |
| Privacy (self) | Viewer **always** sees their own dot when server considers them online; `presenceVisibility` still gates what **others** see |
| Motion | Unchanged — existing mount pop + active ↔ away micro-pop |

## Problem

Patrons cannot verify how they appear to others (online vs away) or get ambient feedback that Sense is tracking their presence. The activity tracker runs locally and heartbeats to the server, but the UI deliberately suppresses self from all presence reads — a product choice from the initial online-badge ship that no longer matches user expectation.

## Product behavior

1. **Signed-in only.** Unsigned users never see a self dot.
2. **Online when heartbeat-active.** Dot appears when the viewer is in the patron app room (or listing room for title detail stack) with a fresh heartbeat; disappears when stale (>45s) or after `DELETE` on tab close — same as others see.
3. **Server mirror everywhere.** Color/state comes from server batch/snapshot reads, not `usePatronActivityState()` local derivation. Accept ~heartbeat interval + poll/SSE throttle lag.
4. **Privacy does not hide self from self.** `preferences.privacy.presenceVisibility` (`friends` \| `public`) continues to filter **other patrons'** visibility of the viewer; the viewer always sees their own state when online.
5. **Listing presence alone.** When the viewer is the only occupant of a title room: corner pill shows **their avatar + dot**, **no** numeric “N other viewing” line. When others join, `viewerCount` reflects **others only**; count line returns; viewer avatar remains in the stack (prepended before other patrons).
6. **Drawer parity.** Presence drawer lists the viewer among visible patrons when they are in the room (same row treatment as others, with self SR labels on the dot).

## Architecture

```text
Portrait surfaces (global)
  PatronPortraitWithMetalTier
    → usePatronPresenceState(handle)          // no longer null for self
    → PatronOnlineProvider.getPresenceState
         → GET /api/realtime/presence/online?handles=…
              → resolveVisiblePresenceForViewer (+ self row when requested)

Listing presence (title detail)
  GET /api/realtime/presence?room=listing:…
    → viewerCount (others only, unchanged)
    → viewingPatrons: [viewerSelf?, …others]   // viewer prepended when in room

PatronOnlineProvider
  → always register viewerHandle in batch set on mount
  → remove viewerHandleKey filter in getPresenceState
  → expose viewerHandle via context for self SR labels
```

## Server changes

### `pickVisiblePresenceForViewer` / resolve helpers

Extend `apps/server/src/lib/patron-presence.ts`:

- After the existing privacy-filtered loop, if the **viewer's handle** is in the normalized requested batch **and** `activeUserIds.has(viewerId)`, append:

```ts
{ handle: viewerHandleLowercase, state: activityByUserId.get(viewerId) ?? "active" }
```

- Resolve the viewer's handle via a **separate lookup by `viewerId`** when not already in `rows` — the batch profile query filters `isPrivate = false`, which would drop a private-profile viewer from `rows` even when they request their own handle.
- Skip duplicate if already present (should not happen — viewer was previously excluded).
- **Do not** apply `presenceVisibility` or `isPrivate` to self — viewer always sees own state when online.
- Mirror the same self-append logic in `resolveVisiblePresenceFromOccupancy` (DO path).

### Listing presence snapshot

Extend `apps/server/src/lib/listing-presence.ts`:

- Add `fetchViewerSelfPatronInRoom(viewerId, activeUserIds, redis, activityOverride?)` — returns a single `ListingPresenceViewingPatron` when viewer is in `activeUserIds`, else `null`. No privacy filter for self.
- Update `getListingPresenceSnapshot` and `getListingPresenceSnapshotFromOccupancy`:
  - `viewerCount` — **unchanged** (`viewerCountExcludingSelf`)
  - `viewingPatrons` — `[viewerSelf, …others]` when self is in room (cap total at existing limit; self counts toward limit)
- `fetchViewingPatronsInRoom` — **unchanged** (others only); compose at snapshot layer.

### API contracts

No new routes. Additive behavior only:

| Endpoint | Change |
|----------|--------|
| `GET /api/realtime/presence/online` | Response may include viewer's own handle in `presence[]` when requested and online |
| `GET /api/realtime/presence?room=listing:…` | `viewingPatrons` may include viewer as first row when they occupy the room |

## Client changes

### `PatronOnlineProvider`

File: `apps/web/src/components/realtime/patron-online-provider.tsx`

- Remove `if (handle === viewerHandleKey) return null` from `getPresenceState`.
- On mount, when `viewerHandle` is set, call `registerHandle(viewerHandle)` so self is always in batch lookups (even before a portrait mounts).
- Expose `viewerHandle` on context (normalized) for label helpers.

### Portrait dot labels

File: `apps/web/src/lib/listing-presence-copy.ts`

- Extend `formatPatronPresenceDotLabel(handle, state, { perspective?: "self" | "other" })`:
  - `self` + `active` → `"You are online now"`
  - `self` + `away` → `"You are away"`
  - default → existing `@handle online now` / `@handle away`

File: `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx`

- Read `viewerHandle` from context; when `normalizePatronOnlineHandle(handle) === viewerHandle`, pass `perspective: "self"` to label formatter.

### Listing presence display

File: `apps/web/src/lib/listing-presence-copy.ts` — `resolveListingPresenceRowDisplay`

- Return non-null when `viewingPatrons.length > 0` even if `viewerCount === 0` (alone-with-self case).
- `countLine` — only populate when `viewerCount > 0` (unchanged logic for others count).

File: `apps/web/src/components/movie/listing-presence-row.tsx`

- When alone (`viewerCount === 0`, stack has self): `aria-label` → `"You are viewing this title"` (or equivalent); omit “other patrons” phrasing.
- Count pill hidden when `countLabel` empty (already conditional on `countLabel`).

File: `apps/web/src/components/movie/listing-presence-drawer.tsx`

- No structural change — self row flows from extended `viewingPatrons`. Use self SR labels on dot via server-provided `presenceState` + portrait self perspective.

### Types

- `fetch-listing-presence.ts` / shared types — no shape change; viewer may appear in `viewingPatrons`.

## Error handling and fallbacks

| Case | Behavior |
|------|----------|
| Viewer handle missing from profile | No self dot; provider skips self registration |
| Redis / dev bus unavailable | Best-effort — no self dot until server path works (same as others today) |
| Batch lookup failure | Keep last snapshot; self dot may stale briefly |
| Viewer private profile | Self still sees own dot (self bypasses public-profile gate for own row only on `/online`; listing self row uses viewer's own profile join, not `isPrivate` gate for self) |
| Reduced motion | Unchanged |

## Testing

### Server unit tests

- `pickVisiblePresenceForViewer` — viewer's handle in batch + active → included with correct `state`; privacy pref does not block self
- `pickVisiblePresenceForViewer` — viewer not active → self omitted
- `getListingPresenceSnapshot` — alone in room → `viewerCount: 0`, `viewingPatrons: [self]`
- `getListingPresenceSnapshot` — self + 1 other → `viewerCount: 1`, self first in patrons
- DO occupancy path parity (`getListingPresenceSnapshotFromOccupancy`)

### Web unit tests

- `formatPatronPresenceDotLabel` — self perspective strings
- `resolveListingPresenceRowDisplay` — alone-with-self returns display with empty `countLine`
- `PatronOnlineProvider.getPresenceState` — returns state for viewer handle when in snapshot map

### Manual QA

1. Signed in — account menu avatar shows green dot within one poll cycle.
2. Switch tab away — dot turns orange on account menu + own profile within ~25s (server mirror).
3. Return and interact — green again after server catches up.
4. Movie detail alone — corner shows your avatar + dot, no count line.
5. Friend opens same title — count line appears (“1 other viewing”); your avatar still in stack.
6. Friend sees your dot per their visibility setting; you always see yours.
7. VoiceOver on self portrait — “You are online now” / “You are away”.

## Out of scope

- Local/immediate self state (client activity tracker as UI source)
- “Preview as stranger” mode for privacy settings
- Last-seen timestamps
- User setting to hide self dot
- Showing self dot on signed-out / public share shells

## Relationship to parent specs

- [`2026-06-16-presence-afk-status-design.md`](./2026-06-16-presence-afk-status-design.md) — colors, motion, heartbeat `activityState` unchanged.
- [`2026-06-16-presence-online-visibility-design.md`](./2026-06-16-presence-online-visibility-design.md) — privacy model unchanged for **other→viewer** visibility; self-view is an explicit exception documented here.
- [`2026-06-16-listing-presence-design.md`](./2026-06-16-listing-presence-design.md) — `viewerCount` remains **others only**; alone UI behavior updated per locked decision C.
