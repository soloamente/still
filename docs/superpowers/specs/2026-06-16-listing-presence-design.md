# Sense — Listing presence (movie / TV detail)

**Status:** Approved (2026-06-16) — brainstorm locked  
**Date:** 2026-06-16  
**Topic:** “N patrons viewing” on title detail — Redis heartbeats + hybrid SSE/poll  
**Parent:** [`2026-06-15-sense-realtime-redis-sse-design.md`](./2026-06-15-sense-realtime-redis-sse-design.md) Phase B  
**Historical UX reference:** [`2026-06-15-liveblocks-realtime-design.md`](./2026-06-15-liveblocks-realtime-design.md) § Presence UX

## Summary

Bring back the **alive** feel on movie and TV detail: a compact row under the community score showing how many other patrons are on the same title page, with **mutual-follow avatars** when applicable. Transport reuses the shipped **Upstash Redis + SSE** stack — no Liveblocks, no WebRTC.

Postgres is **not** involved in presence (ephemeral only). Privacy: strangers see **count only**; mutual follows see up to **3** named chips + `+N`.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Surfaces | **`/movies/[id]`** and **`/tv/[id]`** only — not home, profile, lists, journal |
| Social reveal | Anonymous **count** + **mutual-follow** avatars/`@handle` (max 3 displayed, then `+N`) |
| Updates | **Hybrid** — SSE `presence.updated` on listing room when connected; **~20s poll** fallback |
| Backend filter | **Server-filtered** mutual patrons (no raw viewer-id list to clients) |
| Signed-out | No heartbeat, no UI |
| Alone | Hide row when count excluding self is **0** |

## Problem

After Liveblocks removal (Task 10), title detail has live comments/reactions elsewhere but **no co-viewing signal**. Patrons miss the subtle social proof that others are looking at the same film/show right now.

## Architecture

```text
Detail page mount
  → POST /api/realtime/presence { room }     every ~25s (heartbeat)
  → DELETE /api/realtime/presence { room }   on unmount (leave)
  → register listing room on app-shell SSE
  → on presence.updated → GET snapshot
  → poll GET every ~20s when SSE disconnected

Elysia presence handler
  → ZADD sense:presence:{roomId}  score=now  member=userId
  → ZREMRANGEBYSCORE prune >45s stale
  → if aggregate count changed → publishRealtimeEvent(roomId, { type: "presence.updated", count })
```

**Redis structure:** sorted set per logical room (`listing:movie:{id}` / `listing:tv:{id}`). Score = last heartbeat ms. Prune members with score older than **45s** on each touch. Room key `EXPIRE` 24h (same retention pattern as streams).

**Why ZSET not counters:** Supports per-user membership for server-side mutual intersection without leaking ids over SSE.

## API contracts

### `POST /api/realtime/presence`

- **Auth:** signed-in only (401 otherwise)
- **Body:** `{ room: string }` — must parse as `listing:movie:*` or `listing:tv:*`
- **Access:** `resolveRealtimeRoomAccess` → `allow` for listing rooms
- **Rate limit:** 6/min per user (allows 25s interval + retries)
- **Response:** `204` or `{ ok: true }`
- **Side effect:** touch ZSET; publish `presence.updated` **only when** public count changes

### `DELETE /api/realtime/presence`

- Same validation as POST
- **Side effect:** `ZREM` member; publish if count changed
- Called from client `useEffect` cleanup + `navigator.sendBeacon` on `pagehide` when possible

### `GET /api/realtime/presence?room=listing:movie:550`

- **Auth:** signed-in only
- **Response:**

```ts
{
  viewerCount: number;       // others in room, excludes self
  viewingPatrons: Array<{
    userId: string;
    handle: string;
    displayName: string;
    image: string | null;
    avatarIsAnimated: boolean;
    diaryMetalTier: DiaryMetalTier | null;
  }>;                      // max 8 returned; UI shows first 3 + +N
}
```

- **Server logic:** active userIds from ZSET → `viewerCount = |active| - 1` → join **public** `profile` rows for other patrons in room (`isPrivate = false`, handle required); private profiles stay count-only

**SSE payload (public only):**

```ts
{ type: "presence.updated"; count: number }  // total patrons in room INCLUDING self, OR excluding — pick one and document in plan; recommend **excluding self** to match GET viewerCount
```

Use **excluding self** for both GET and SSE so clients can render without an extra fetch when only count changed; still **refetch GET** when mutual chips may have changed (any `presence.updated`).

## UI

### Placement

Under `MovieDetailCommunityRatingHero` `variant="compact"`, above primary action pills — movie and TV detail hero stacks.

### Components

| Component | Role |
|-----------|------|
| `ListingPresenceProvider` | Heartbeat + leave + SSE register + poll; context for snapshot |
| `ListingPresenceRow` | Presentational row (count copy + mutual chips) |

### Copy

| State | Copy |
|-------|------|
| Alone | *(hidden)* |
| 1 other, no mutuals | `1 patron viewing` |
| N others, no mutuals | `{N} patrons viewing` |
| Mutuals present | chips + `@handle`; trailing count if strangers remain |

**Label:** `Patrons viewing this title` (sr-only section); visible line is count/chips only.

### Chrome

- `text-sm text-muted-foreground`, centered like following-ratings row
- `PatronPortraitAvatar` + profile links for mutuals
- No borders/rings; software GPU → no `backdrop-blur` on chips

## Realtime integration

- Add `presence.updated` to `@still/realtime` `event-types.ts` + tests
- Listing room already `allow` in `resolveStaticRealtimeRoomAccess`
- `ListingPresenceProvider` calls `useRegisterRealtimeRoom(listingMovieRoomId(id))`
- Subscribe via `useRealtimeSubscription`; on event → refetch `GET` snapshot (debounced 300ms)

## Error handling

| Failure | Behavior |
|---------|----------|
| Redis unset (dev) | Heartbeat no-op; GET returns `{ viewerCount: 0, mutualPatrons: [] }`; row hidden |
| Heartbeat 429 | Back off; row may go stale until TTL expires |
| SSE down | Poll every 20s |
| GET fails | Keep last good snapshot; no toast |

## Instrumentation

Emit existing client product events (unchanged kinds):

- `realtime.presence.join` — first successful heartbeat on surface (`surface`: `movie` \| `tv`)
- `realtime.presence.leave` — on unmount leave call

## Testing

| Layer | Coverage |
|-------|----------|
| `@still/realtime` | Parse `presence.updated` |
| `listing-presence.ts` | ZSET touch/prune/count; mutual intersection (mock db) |
| Routes | POST/DELETE/GET auth, room validation, rate limit |
| `listing-presence-row` | Copy/pluralization; hidden when count 0 |
| Manual | Two browsers same title → count increments; mutual follow sees chip; leave → count drops |

## Out of scope

- `/home` catalogue presence, profile filmography, Community Activity live rows
- List editor presence (“N curators editing”) — separate spec
- Push notifications (“X is viewing”)
- Tab-idle pause (Phase B.1 polish)
- Signed-out / SEO crawler presence

## Success criteria

1. Two signed-in sessions on the same movie → both see `1 patron viewing` (or higher).
2. Mutual follows see avatar + `@handle`; strangers do not.
3. Alone on page → no row.
4. SSE connected → count updates within ~2s of other tab opening/closing; poll catches up when SSE off.
5. No Liveblocks deps; works with existing Upstash env on server + web.
