# Social + perf feature batch — design spec

**Date:** 2026-06-01
**Status:** Approved (2026-06-01)
**Approach:** One combined spec covering five small, independent features that share app surfaces (movie detail, profile, home community, diary/quick-log). Each ships behind existing patterns; no shared new subsystem.

## Problem

Five requested improvements, grouped because they touch overlapping surfaces and reuse existing infrastructure:

1. **Friends' ratings on movie detail** — the film page's community section shows only the global average rating + review count; it doesn't surface how the people you actually know rated the title.
2. **Followers / following lists** — profile follower/following counts are not tappable; there's no way to browse who follows a patron or who they follow.
3. **Slow profile + home community rail** — perceived slow loads (largely a deploy-region issue already addressed; remaining server-side waterfalls + uncached global aggregates).
4. **No way to remove a watched item** — patrons can edit a log but cannot delete it from the product UI, despite `DELETE /api/logs/:id` existing.
5. **List author missing in movie community section** — the film page "Lists" tab shows lists that include the title but not who made them.

## Goals

1. Surface mutual-follow friends' ratings on the film page community section.
2. Make follower/following counts open a browsable drawer with per-row follow actions.
3. Cut server-side latency on the home community rail (parallelize + cache global aggregates); confirm region colocation.
4. Let patrons remove a watched log with a low-friction, reversible flow.
5. Show the list owner under each list in the film page community Lists tab.

## Non-goals

- Real-time push for ratings/follows (polling/refresh only; out of scope here).
- A dedicated `/community` route (the "community page" is the community rail/browse mode on `/home`).
- Removing watched items from surfaces other than the Quick Log edit sheet in v1 (movie-detail surface deferred).
- Changing the follow data model or mutual-follow semantics.
- Blocking/muting, list collaborator permissions, or notification changes.

---

## Feature 1 — Friends' ratings on movie detail

**"Friend" = mutual follow.** Uses the existing `follow.isMutual` flag (a follow row where the viewer follows the target and the target follows back).

### Server

New endpoint (movie + TV parity):

```
GET /api/movies/:id/friends-ratings   -> FriendRatingRow[]
GET /api/tv/:id/friends-ratings        -> FriendRatingRow[]   (mirrors movie)
```

- Auth required; returns `[]` for signed-out viewers.
- Query: the viewer's mutual-follow set (`follow` where `followerId = viewer.id AND isMutual = true`) joined to `log` for the requested `movieId`/`tvId`, joined to `user` + `profile` for avatar/handle.
- Only include logs that carry signal: `rating IS NOT NULL OR liked = true`.
- Order by `rating DESC NULLS LAST`, then `watchedAt DESC`. Limit 12; also return total matching count so the UI can render `+N more`.
- `FriendRatingRow`: `{ userId, handle, displayName, avatarUrl, rating: number | null, liked: boolean, watchedAt }`.
- Lives in `apps/server/src/routes/movies.ts` (and the TV route), near the existing community-stats handler. Add a unit test for the mutual-follow + signal filter in `apps/server/src/lib/` (extract the query into a small lib fn, e.g. `friends-ratings.ts`, to keep the route thin and testable).

### Web

- New component `movie-detail-friends-ratings.tsx` rendering **Layout A**: a horizontal avatar row labeled **"From friends"** in the existing community section (`bg-card`). Each entry: avatar, `★ x.x` (use `formatLogRatingDisplay`) or `♥ liked` when no rating, and handle. A `+N more` chip when the total exceeds the rendered limit.
- Fetched in the movie detail RSC alongside existing community data (added to the page's existing parallel fetch, not a new waterfall).
- Section hidden entirely when the viewer is signed out or has zero friend logs for the title.

---

## Feature 2 — Followers / following drawer

### UI

- **Reuses `DetailVaulSheet`** (the actor-filmography bottom sheet in `apps/web/src/components/movie/detail-vaul-sheet.tsx`) so it matches the actor drawer exactly.
- New component `profile-follows-drawer.tsx` + a small zustand store mirroring `usePersonFilmography` (open with `{ targetUserId, tab: "followers" | "following" }`).
- Drawer body: a two-tab header (**Followers · N** / **Following · N**) and a scrollable list of rows.
- **Row:** avatar + display name + `@handle` + a follow button. Tapping the row navigates to that profile; the button is a separate tap target.
- Profile header follower/following counts become buttons that open the drawer on the matching tab.

### Server

- Existing `/api/follows/of/:userId/followers` and `/following` already return `user` + `profile`.
- **Extend both** to include a `viewerFollows: boolean` per row (left join `follow` on `followerId = viewer.id AND followingId = row.userId`) so each row's button renders correct state without N extra round trips. When signed out, `viewerFollows` is `false` for all rows.
- Follow/unfollow reuses the existing `POST`/`DELETE /api/follows/:userId`; button state updates optimistically per row.

### Button states

- Not following + not me → **Follow**
- Following → **Following** (tap to unfollow)
- They follow me but I don't follow them (followers tab) → **Follow back**
- Row is the viewer themself → no button.

---

## Feature 3 — Speed up profile + home community rail

- **Profile route** (`apps/server/src/routes/profiles.ts`): already parallelized into one batch + badges/achievements folded in (done in prior work). No further change required beyond what's merged.
- **Home community rail:** `fetchHomeCommunityCore` already parallelizes its four web-layer calls. Remaining work is server-side:
  - **Curator spotlight** (`fetchCuratorSpotlightPatrons` in `creator-recognition.ts`): run its two aggregate queries (`listAgg`, `reviewAgg`) concurrently with `Promise.all`.
  - **Cache the curator spotlight result** — it is **global and non-personalized**, so wrap it in a short-TTL cache (e.g. 60s in-process memo, or Next `unstable_cache` at the call site) keyed by the period. This removes a full-table aggregate scan from the hot path on every community load.
  - Audit the `lists`, `reviews.recent`, and `feed` route handlers behind the community payload for internal sequential `await db` waterfalls; parallelize any found, matching the profile-route pattern.
- **Deploy:** confirm the Frankfurt (`fra1`) region pin (already added to `apps/web/vercel.json` + `apps/server/vercel.json`) is live; it is the dominant production latency factor and requires a redeploy to take effect.

## Feature 4 — Remove watched items

### Client API

- Add `deleteLog(logId: string)` to `apps/web/src/lib/still-api-fetch.ts`, calling `DELETE /api/logs/:id` (route already exists).

### UX

- Add a destructive **"Remove from watched"** action at the bottom of the **Quick Log sheet when in edit (PATCH) mode** (`quick-log-sheet.tsx`). Hidden in create mode.
- **Undo toast pattern:**
  1. On tap: capture the current log payload (movieId/tvId, rating, liked, watchedAt, note, venue, etc.), close the sheet, call `deleteLog`, then `router.refresh()` so the entry disappears immediately.
  2. Show a toast: *"Removed '<title>' from watched — Undo"* (~6s).
  3. **Undo = re-POST** the captured payload via the existing create path (`postLog`), producing a new log with identical content (new id is acceptable), then `router.refresh()`.
- Errors on delete surface a toast and restore the entry (re-refresh).

### Notes

- v1 home for the action is the Quick Log edit sheet only; surfacing it on movie detail is deferred (non-goal).
- TV logs use the same `DELETE /api/logs/:id`; the edit sheet already handles both.

## Feature 5 — List author byline in movie community section

### Server

- Extend `GET /api/movies/:id/lists` (and TV equivalent if present) to join the list owner: `list.userId → user` + `profile` for `{ handle, displayName }`. Return the owner alongside each list row.

### Web

- In the movie detail Lists tab (`movie-detail-explore-tabs.tsx` list rows), render a **"by @handle"** byline under the list title (links to the owner's profile).

---

## Testing

- **Server:** unit tests for the friends-ratings query (mutual-follow + `rating/liked` signal filter, ordering, limit/count), the extended followers/following `viewerFollows` flag, and the list-owner join shape. Follow existing `apps/server/src/lib/*.test.ts` conventions.
- **Web:** verify the friends section hides when empty/signed-out; drawer tab switching + per-row button state; remove → undo restores an equivalent log; list byline links resolve.
- Run `bun run check-types` in both `apps/server` and `apps/web` (note: the working branch carries pre-existing type errors unrelated to this work; ensure no *new* errors in touched files).

## Open questions (resolved)

- **Who is a "friend"?** Mutual follows (`follow.isMutual`). ✅
- **Friends-ratings layout?** Layout A (compact avatar row). ✅
- **Drawer style?** Reuse `DetailVaulSheet` (actor drawer). ✅
- **Drawer rows actionable?** Yes — per-row follow buttons via extended endpoints. ✅
- **Remove safety pattern?** Undo toast, undo = re-POST. ✅
- **"Community page"?** Home community rail/browse mode. ✅
