# Streak bug, Pro theme picker bug, and Profile about section redesign

**Date:** 2026-06-03
**Status:** Approved (design)

## Summary

Three independent fixes grouped in one spec:

1. **Streak shows 1 day** despite no missed days — stale `user_streak` after log date edits.
2. **Pro theme picker intermittently shows only 3 free themes** — duplicate profile fetches can deliver inconsistent `isPro`.
3. **Profile about section redesign** — replace the long vertical stack with a 4-cell stats grid + collapsible "more" panel for bio / heatmap.

---

## Fix 1 — Watch streak stale on log edit / delete

### Root cause

`syncWatchStreakForUser(userId, watchedAt)` is called only in the log **POST** handler
(`apps/server/src/routes/logs.ts` ~line 197). The log **PATCH** and **DELETE** handlers
touch `watched_at` but never resync the streak. The `user_streak` row becomes stale:

- Edit a log's date → `user_streak.lastActiveDay` may point to a day that no longer has
  a log (or the new day was not applied) → streak shows incorrectly.
- The heatmap reads directly from `log.watched_at` (always correct) → visible mismatch.

### Fix

After a log **PATCH** or **DELETE**, call `backfillWatchStreakFromLogs(userId)` — the
same full-rebuild path used for import repair. It re-derives the streak from the entire
diary, so any date mutation is correctly reflected.

**PATCH handler** (`PATCH /api/logs/:id`, ~line 270):

```
// After the db.update().returning() succeeds:
if (updated && body.watchedAt !== undefined) {
  void backfillWatchStreakFromLogs(user.id).catch(...)
}
```

Running the backfill only when `body.watchedAt` is in the patch body avoids an
unnecessary full scan for edits that only change rating/note/visibility.

**DELETE handler** (`DELETE /api/logs/:id`, add after row deletion):

```
void backfillWatchStreakFromLogs(user.id).catch(...)
```

Every delete can affect the living streak (if the deleted log was on the most recent
active day), so always backfill on delete.

### Files changed

- `apps/server/src/routes/logs.ts` — add `backfillWatchStreakFromLogs` import + two call
  sites (PATCH, DELETE).

### Testing

- Create two logs on consecutive days → streak = 2.
- Edit the older log's date to tomorrow → streak should recalculate from full history.
- Delete the most recent log → streak should reflect the next most-recent day.
- Edit a log's rating only (no `watchedAt` in body) → no backfill triggered.

---

## Fix 2 — Pro theme picker intermittent failure

### Root cause

`(app)/layout.tsx` and `home/page.tsx` both independently call `GET /api/profiles/me`
in the same request. Each call is a separate HTTP round-trip (no deduplication). If the
two responses arrive with any inconsistency — or if the home page fetch returns before
`isPro` is propagated — `profileData.isPro` arrives as `undefined`:
`Boolean(undefined) === false` → only the 3 free themes are shown in the picker.

Secondary issue: the layout's type cast is too narrow —
`profileRes.data as { handle?: string; displayName?: string }` — `isPro` is absent from
the TypeScript type even though the runtime value is present.

### Fix

Introduce a **cached profile fetcher** using Next.js `cache()` so the fetch is executed
at most once per server request regardless of how many components call it.

**New file: `apps/web/src/lib/fetch-me-profile.ts`**

```ts
import { cache } from "react";
import { serverApi } from "@/lib/server-api";

export type MeProfile = {
  handle: string;
  displayName: string;
  isPro: boolean;
  preferences: Record<string, unknown> | null;
  // …other fields used across layout + home
} | null;

export const fetchMeProfile = cache(async (): Promise<MeProfile> => {
  const api = await serverApi();
  const res = await api.api.profiles.me.get();
  if (res.error || !res.data) return null;
  return res.data as MeProfile;
});
```

**`(app)/layout.tsx`** — replace the inline profile fetch with `fetchMeProfile()`.
Update the type so `isPro` is explicit.

**`home/page.tsx`** — replace its inline `api.api.profiles.me.get()` call with
`fetchMeProfile()`. Both now share the same memoised result within the request.

### Files changed

- `apps/web/src/lib/fetch-me-profile.ts` — new file.
- `apps/web/src/app/(app)/layout.tsx` — use `fetchMeProfile`.
- `apps/web/src/app/(app)/home/page.tsx` — use `fetchMeProfile`.

### Testing

- As a Pro user: open `/home` — theme picker shows all 5 themes.
- Hard-refresh 10 times — result is always consistent.
- Simulate API failure (stop server briefly): layout renders without redirect loop; `isPro`
  defaults to `false` gracefully (acceptable fallback — a refresh restores Pro state).

---

## Fix 3 — Profile about section redesign

### Current layout (problem)

`ProfilePatronHeader` stacks ~10 elements in a centered column below the avatar:
name → handle → curator badge → taste signature → heatmap → pinned reviews →
bio → streak → byline (pronouns · followers/following · count · location · website) →
actions.

This is a wall of information with no visual hierarchy. The `ProfilePatronByline`
component renders everything as a single wrapped dot-separated text row, making it
easy to miss important info.

### New layout

Replace the current stacking order inside `ProfilePatronHeader`'s center column with:

```
display name
handle  [Curator chip]          ← inline on one row when curator
taste signature                 ← unchanged
4-cell stats grid               ← NEW (replaces byline)
[Follow]  [Compare taste]       ← actions unchanged
[more ›] collapsible panel      ← NEW (bio + heatmap + location + website)
pinned reviews strip            ← unchanged, below collapsible
```

#### 4-cell stats grid

A 2×2 or 1×4 grid of small `bg-muted/30` rounded cells, each showing a number + label:

| Cell | Own profile | Other profile |
|------|-------------|---------------|
| films | total logged (movies + tv) | same |
| followers | tappable → opens followers drawer | same |
| following | tappable → opens following drawer | same |
| streak | `🔥 N` + status line | **hidden** (show nothing or leave 3 cells) |

Followers / following cells reuse `ProfileFollowsTrigger` (already wired in `ProfilePatronByline`).

The streak cell is the existing `ProfileWatchStreak` data but rendered as a compact
number inside the grid, not as the full pill — keep the pill's "Use shield" action
accessible via a tap on the cell (sheet or inline expand, TBD during implementation).
On other people's profiles the streak cell is simply not rendered (3-cell layout).

#### Collapsible "more" panel

A single toggle below the actions row. Default: **collapsed**. Toggle state is
ephemeral (not persisted). When expanded, shows:

- Bio text (if set)
- Location + website link (if set)
- `ProfileActivitySignature` heatmap

If none of bio / location / website / heatmap data is present, the toggle is hidden entirely.

The toggle trigger is a small text button: `more ›` / `less ‹`.

Pronouns, currently in `ProfilePatronByline`, move into the collapsible panel (shown
after the bio line, before location).

#### Pinned reviews

`ProfilePinnedReviewsStrip` stays below the collapsible panel, still inside the header.

### Component changes

**`ProfilePatronByline`** — no longer used in the header. Either delete or repurpose
for other surfaces. The new header composes its own stats grid inline.

**`ProfilePatronHeader`** — restructure the JSX inside the center column per the layout
above. Extract the collapsible into a small co-located `ProfileAboutCollapsible`
client component (needs `useState` for open/close).

**`ProfileWatchStreak`** — currently a self-contained client pill. The stats grid needs
the streak count as a number; either:
- Pass the streak data down via a new prop on `ProfilePatronHeader` (requires server
  fetch at profile page level), **or**
- Keep `useWatchStreak()` inside a new `ProfileStreakStatCell` client component that
  reads it the same way the existing pill does — no prop threading needed.

Preferred: **`ProfileStreakStatCell`** — isolated client component, matches existing
pattern of the streak pill, no new prop chain.

### Files changed

- `apps/web/src/components/profile/profile-patron-header.tsx` — restructure center column.
- `apps/web/src/components/profile/profile-about-collapsible.tsx` — new client component.
- `apps/web/src/components/profile/profile-streak-stat-cell.tsx` — new compact streak cell.
- `apps/web/src/components/profile/profile-patron-byline.tsx` — remove from header call site
  (keep file; assess whether any other consumer exists before deleting).

### Testing

- Own profile: 4 cells visible (films · followers · following · streak).
- Other profile: 3 cells (films · followers · following). Streak cell absent.
- Collapsible hidden when bio + location + website all empty and heatmap has no data.
- Collapsible expands / collapses on tap; state resets on navigation.
- Follower / following cells open the existing followers drawer.
- Pinned reviews still visible below the collapsible.
- `ProfilePatronByline` no longer rendered in the profile header.

---

## Build order

1. Fix 1 (streak) — server-only, no UI changes, fast.
2. Fix 2 (Pro themes) — new lib file + two call-site swaps, low risk.
3. Fix 3 (profile redesign) — most UI surface area, do last.
