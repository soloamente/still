# Sense — Presence online visibility controls (movie / TV detail)

**Status:** Approved (2026-06-16) — brainstorm locked  
**Date:** 2026-06-16  
**Topic:** Online-now status badges with user-controlled visibility  
**Parent:** [`2026-06-16-listing-presence-design.md`](./2026-06-16-listing-presence-design.md)

## Summary

Add explicit **online now** status for title presence and let each user choose who can see it:

- Presence status shows as a **small green dot** on avatars.
- Dot appears in both the compact `ListingPresenceRow` and the presence drawer rows.
- Visibility is controlled by a dedicated privacy preference:
  - `friends` (default)
  - `public`
- Control lives in **Settings → Privacy**.

This is implemented as a dedicated presence-only setting (not tied to profile visibility).

## Locked decisions

| Topic | Decision |
|---|---|
| Status signal | Online now only (no idle/last-seen states) |
| Surface | Avatar row + drawer rows |
| Badge style | Small green dot on avatar |
| Visibility model | User-selectable: `friends` or `public` |
| Default | `friends` |
| Setting location | Settings → Privacy |
| Architecture choice | Dedicated presence-only visibility setting |

## Product behavior

1. A user is considered online now when their listing-presence heartbeat is active.
2. If the viewer is allowed to see that user, avatar identity renders with a green dot.
3. If the viewer is not allowed to see that user, identity is hidden; anonymous count behavior remains unchanged.
4. Signed-out users do not get identified online patrons.

## Data model

Add a dedicated preference key in the user preferences payload:

- `preferences.privacy.presenceVisibility: "friends" | "public"`
- Default for missing/legacy data: `"friends"`

This preference applies only to listing-presence identity visibility.

## API and server logic

### Existing presence snapshot endpoint

`GET /api/realtime/presence?room=listing:movie:{id}` (and TV equivalent) keeps the same contract for count and visible patrons, with one additive flag:

- Patron rows include `isOnlineNow: true` for UI clarity.

### Visibility filtering

Server decides which patrons are returned as identified rows:

- `public`: patron can be returned to any eligible signed-in viewer.
- `friends`: patron can be returned only to friend/mutual viewers.

If viewer relationship data is unavailable, fail closed for identity (count-only behavior).

### Realtime behavior

No transport change:

- Heartbeats/TTL remain the source of truth for online-now.
- SSE + poll fallback remain unchanged.

## UI design

### Compact row (`ListingPresenceRow`)

- Keep current layout, counts, and stacking.
- Add a green online dot on each visible patron avatar.
- Keep row text compact; no extra inline "Online" label.
- Add screen-reader phrasing: `@handle online now`.

### Drawer rows

- Apply the same green dot treatment on row avatars.
- Keep copy and sorting unchanged.

## Settings design

In **Settings → Privacy**, add:

- Label: `Who can see when I’m online on title pages?`
- Options:
  - `Friends only` (default)
  - `Public`

Changes apply immediately to subsequent presence snapshot reads.

## Error handling and fallbacks

- Missing preference key: treat as `friends`.
- Relationship lookup failure: hide identity, preserve count.
- SSE disconnect: poll fallback keeps status reasonably fresh.

## Testing

1. **Server unit tests**
   - Defaulting to `friends` when unset
   - `friends` visibility allows mutual/friend viewers only
   - `public` visibility allows non-friend viewers
   - Relationship failure path returns count-only identity filtering

2. **Web component tests**
   - Green dot renders in compact row for returned patrons
   - Green dot renders in drawer rows
   - Screen-reader label includes online-now context

3. **Manual QA**
   - With `friends`, friend viewer sees dot + identity; stranger does not
   - With `public`, both friend and stranger viewers see dot + identity
   - Changing setting in Privacy takes effect without restarting sessions

## Out of scope

- ~~Idle / away / last-seen states~~ → **Away (AFK) orange dot:** [`2026-06-16-presence-afk-status-design.md`](./2026-06-16-presence-afk-status-design.md)
- Last-seen timestamps and “idle Xm ago” copy (still out of scope)
- Presence controls outside movie/TV detail presence surfaces
- Push notifications for online status
