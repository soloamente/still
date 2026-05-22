# Community Watch Leaderboards (Film & TV)

**Status:** Approved (brainstorm 2026-05-22)  
**Date:** 2026-05-22  
**Scope:** Global public-patron rankings by diary log volume on `/home` Community — separate **Film ranks** and **TV ranks** feeds, period filters, tier-card podium, watch-ledger drawer  
**Builds on:** `log` (movie/TV XOR), `profile.isPrivate`, Community lobby (`HomeCommunityLobby`, `HOME_COMMUNITY_FEEDS`), Achievements lobby shell, `PersonFilmographyDrawer` / `DetailVaulSheet`

## Summary

Patrons compete on how much they watch in a chosen window. Two independent boards count **movie logs** and **TV logs** among users with **public profiles**. The UI lives under **Community** on `/home` as two new chips (**Film ranks**, **TV ranks**), with **Week · Month · Year · All time** period pills, a **tier-card podium** for places 1–3, and a flat list from #4. Tapping a patron’s **count** opens a **Vaul drawer** listing every qualifying log in that period (same interaction model as cast filmography on movie detail).

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Podium layout | **Tier cards (B)** — three `bg-background` tiles on `bg-card` tray; center (1st) slightly lifted |
| Audience | **All patrons with public profiles** (`profile.isPrivate = false`) |
| Visibility / counting | **Public profile gate only** — logs have no per-entry `isPublic`; private profiles are excluded entirely |
| Film metric | Count of **`log` rows where `movie_id` IS NOT NULL** in period |
| TV metric | Count of **`log` rows where `tv_id` IS NOT NULL** in period (each show/season/episode log counts) |
| Rewatches | **Every log row counts** (no dedupe by title) |
| Location | **`/home?browse=community`** — two new `sort` values, not a standalone route |
| Community chips | **Five chips, centered:** Lists · Reviews · Activity · **Film ranks** · **TV ranks** |
| Period filters | **Week · Month · Year · All time** on main view (`?period=`) |
| Period timezone | **Viewer-local** boundaries via `tz` query param (IANA or offset); fallback **UTC** |
| Count interaction | **Pressable count** → global **`PatronWatchLedgerDrawer`** (Vaul, zustand store) |
| Drawer content | Chronological ledger for that patron + kind + **same period** as parent filter |
| Data approach (v1) | **Live SQL aggregate** on `log` + `profile` (no rollup table in v1) |
| List cap | **Top 50** on board; always return **viewer rank** when signed in |
| Blocked users | **Exclude** if viewer has blocked or is blocked by patron (match feed safety) |
| Motion | `motion/react`, sliding period pill, staggered podium enter, `scale(0.96)` on count press |
| Surfaces | Flat rows — **no borders/rings/shadows** on rank rows; `PatronPortraitAvatar` for faces |

## Problem

1. Community surfaces today show lists, reviews, and activity, but there is **no playful competition** for “most watched” in a time window.
2. Film and TV watching are **different behaviors** — one combined score would mis-rank series binge-loggers vs film marathoners.
3. Patrons need **drill-down proof** (what did they watch this month?) without leaving `/home`.

## User stories

1. As a patron on Community → **Film ranks**, I see who logged the most **movies** this month and where I rank.
2. As a patron on Community → **TV ranks**, I see the same for **TV diary logs** in the same period chips.
3. As any signed-in viewer, I tap **24** next to `@mara` and see every **public** movie log she filed in that month in a bottom sheet.
4. As a visitor with a private profile, I do not appear on either board (profile privacy is the opt-out).
5. As a patron, switching **Week → Year** updates podium, list, and my footer rank without losing browse context.

## Information architecture

### URL shape

```
/home?browse=community&sort=film-ranks&period=month
/home?browse=community&sort=tv-ranks&period=week
```

| Param | Values | Default |
|-------|--------|---------|
| `browse` | `community` | — |
| `sort` | `film-ranks` \| `tv-ranks` (plus existing lists/reviews/activity) | `lists` (unchanged default for generic community) |
| `period` | `week` \| `month` \| `year` \| `all` | `month` when on rank feeds |

Persist `sort` + `period` in lobby session restore (`home-lobby-persist`) alongside existing community prefs.

### Chip row (centered)

Extend `HOME_COMMUNITY_FEEDS` in `apps/web/src/lib/home-community-feed.ts`:

| `id` | Label | Hint |
|------|-------|------|
| `film-ranks` | Film ranks | Patrons ranked by movie diary logs in this period |
| `tv-ranks` | TV ranks | Patrons ranked by TV diary logs in this period |

Update `HomeCatalogSortChips` community branch: `justify-center` on the five-chip rail (user request).

### Period toolbar

Second row below community chips (only when `sort` is `film-ranks` or `tv-ranks`):

- `SegmentedPillToolbar` with `layoutId="home-leaderboard-period-pill"`
- URL-backed via `?period=` (not client-only)

## UI specification

### Page structure (inside `HomeCommunityLobby`)

```
[ optional centered intro copy — one line ]
[ Period: Week | Month | Year | All time ]
[ Tier-card podium: 2nd | 1st | 3rd ]
[ Rank rows 4..N ]
[ Viewer sticky footer if rank > 3 or off-board but has logs ]
```

Reuse achievements-adjacent tokens:

- Outer tray: `HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME` patterns / `bg-card` section on `bg-background` floor
- Rows: `bg-background` on `bg-card`, no row border, no box-shadow
- Count: `font-variant-numeric: tabular-nums`, `DetailMotionPressable` or shared press spring from `detail-action-motion.ts`

### Podium (tier cards)

| Slot | Label | Visual |
|------|-------|--------|
| Left | 2nd | Standard tile |
| Center | 1st | `translateY(-0.65rem)` lift, subtle accent wash on tile (desert orange mix, not full accent fill) |
| Right | 3rd | Standard tile |

Each tile: rank label, `PatronPortraitAvatar`, `@handle`, count.

### Rank list (4+)

| Column | Content |
|--------|---------|
| Position | `tabular-nums` |
| Avatar | `PatronPortraitAvatar` + `profilePatronAvatarImageUrl(handle)` |
| Name | `@handle` + optional display name truncation |
| Count | Pressable number → opens drawer |

Highlight viewer’s row with muted background when present in list.

### Empty states

Use `HomeCommunityEmpty` pattern (full-height centered):

| Feed | Title | Description |
|------|-------|-------------|
| Film ranks | No film logs this period | When the window has zero public movie logs community-wide |
| TV ranks | No TV logs this period | Same for TV |

### Drawer (`PatronWatchLedgerDrawer`)

Mirror `person-filmography-drawer.tsx`:

- `DetailVaulSheet` + `DetailDrawerScrollBody` + bottom scroll scrim
- Title: `{displayName} — films this month` (dynamic kind + period label)
- Rows: poster thumb (`FeedListingThumb` or diary thumb), title link to `/movies/[id]` or `/tv/[id]`, `watchedAt` formatted, optional rating via `logRatingToDisplay` helpers
- `data-vaul-no-drag` on scroll body; lock scroll via `useLockDrawerScroll`

**v1:** Drawer does not host its own period picker — inherits parent `period`.

## API specification

### `GET /api/leaderboard/films`

Query: `period=week|month|year|all`, `tz=<IANA or offset minutes>` (optional)

Response:

```ts
type LeaderboardResponse = {
  kind: "films" | "tv";
  period: "week" | "month" | "year" | "all";
  window: { start: string; end: string }; // ISO, for client display/debug
  entries: Array<{
    rank: number;
    userId: string;
    handle: string;
    displayName: string;
    count: number;
  }>;
  viewer: { rank: number; count: number } | null;
};
```

### `GET /api/leaderboard/tv`

Same contract with `kind: "tv"` filter on `log.tv_id`.

### `GET /api/leaderboard/films/:userId/logs`

Query: `period`, `tz` — returns drawer payload:

```ts
{
  user: { handle, displayName };
  period: ...;
  items: Array<{
    logId: string;
    watchedAt: string;
    movieId?: number;
    tvId?: number;
    title: string;
    posterPath: string | null;
    rating: number | null; // stored tenths — use display helpers in UI only
  }>;
}
```

### `GET /api/leaderboard/tv/:userId/logs`

TV variant (join `tv` for titles/posters).

### Query rules (server)

1. Join `log` → `profile` on `user_id`.
2. `WHERE profile.is_private = false`.
3. `AND log.movie_id IS NOT NULL` (films) or `AND log.tv_id IS NOT NULL` (tv).
4. `AND log.watched_at >= :start AND log.watched_at < :end` (half-open interval).
5. If viewer authenticated: exclude pairs in `block` (either direction).
6. `GROUP BY user_id` → `count(*)`, order `count DESC`, tie-break `max(watched_at) ASC`, `handle ASC`.
7. Limit 50 for `entries`; separate query or window function for `viewer` rank.

### Period windows (viewer timezone)

| `period` | Window |
|----------|--------|
| `week` | Start of ISO week (Monday 00:00) through start of next week |
| `month` | Start of calendar month through start of next month |
| `year` | Start of calendar year through start of next year |
| `all` | No lower bound; `end` = now |

Implement in `apps/server/src/lib/leaderboard-period.ts` (+ unit tests).

### Auth

- **View board:** public (no session required).
- **Viewer rank footer:** requires session.
- **Drawer for another patron:** public if profile public; 404 if private.

## Project structure

| Area | Path |
|------|------|
| Community feed types | `apps/web/src/lib/home-community-feed.ts` |
| Period parse/build URL | `apps/web/src/lib/home-leaderboard-period.ts` |
| Lobby body | `apps/web/src/components/home/home-community-leaderboard.tsx` |
| Podium + row | `apps/web/src/components/home/home-leaderboard-podium.tsx`, `home-leaderboard-row.tsx` |
| Drawer | `apps/web/src/components/home/patron-watch-ledger-drawer.tsx` |
| Server routes | `apps/server/src/routes/leaderboard.ts` |
| Period math | `apps/server/src/lib/leaderboard-period.ts` |
| Register route | `apps/server/src/index.ts` (or existing router mount) |
| Home page data | `apps/web/src/app/(app)/home/page.tsx` — fetch when `sort` is rank feed |
| Tests | `*.test.ts` next to period helpers; route tests if pattern exists |

## Code style

- Import motion from `motion/react`, not `framer-motion`.
- Portrait URLs via `profilePatronAvatarImageUrl(handle)` — never raw `user.image` in `<Image>`.
- Ratings in UI: `logRatingToDisplay` / `formatStoredLogRatingDisplay` only.
- URL builders colocated with parsers (`buildHomeLobbyHref` extended for `period`).

```tsx
// Period chip — URL-backed, matches SegmentedPillToolbar elsewhere
<SegmentedPillToolbar
  layoutId="home-leaderboard-period-pill"
  aria-label="Leaderboard period"
  value={period}
  onChange={(next) =>
    router.replace(buildHomeLobbyHref({ browse: "community", sort, period: next }))
  }
  options={HOME_LEADERBOARD_PERIODS}
/>
```

## Commands

```bash
# Dev
cd apps/web && bun run dev
cd apps/server && bun run dev

# Typecheck / build
cd apps/web && bun run build
cd apps/server && bun run build  # if applicable

# Tests (Bun)
cd apps/web && bun test src/lib/home-leaderboard-period.test.ts
cd apps/server && bun test src/lib/leaderboard-period.test.ts
```

## Testing strategy

| Layer | What to test |
|-------|----------------|
| Unit | `leaderboard-period.ts` — week/month/year/all boundaries across timezones and DST edges |
| Unit | `parseHomeCommunityFeed` accepts `film-ranks` / `tv-ranks`; legacy aliases ignored |
| API | Films vs TV separation; private profiles excluded; block filter; tie-break ordering |
| API | Drawer returns only logs inside window |
| Manual | Community chips centered; podium order 2-1-3; count opens drawer; period persistence across nav |

## Boundaries

**Always**

- Reuse existing lobby shell, avatar, drawer, and motion primitives.
- Keep film and TV leaderboards independent end-to-end.
- Use tabular numerals on counts and ranks.
- Run `bun test` on new period helpers before merge.

**Ask first**

- Adding DB indexes beyond existing `log_user_watched_idx` (e.g. composite on `(watched_at, movie_id)`).
- Caching layer or materialized rollup if query latency is high in production.
- Showing leaderboard to signed-out users in nav marketing.

**Never**

- Count logs from `is_private = true` profiles.
- Mix TV logs into film ranks or vice versa.
- Add per-log privacy flags in this project (out of scope).
- Use borders/shadows on feed-style rank rows.

## Success criteria

- [ ] `/home?browse=community&sort=film-ranks&period=month` renders tier podium + list from live data.
- [ ] `/home?browse=community&sort=tv-ranks&period=week` uses TV logs only.
- [ ] Private profiles never appear; blocked patrons hidden for signed-in viewer.
- [ ] Week / Month / Year / All time change counts and podium without full page reload (soft nav).
- [ ] Tapping a count opens drawer with correct titles and posters for that window.
- [ ] Community chip row is **centered** with five chips.
- [ ] Signed-in viewer sees own rank when they have ≥1 qualifying log in period.
- [ ] `bun run build` passes in `apps/web`.

## Open questions

_None — all resolved in brainstorm 2026-05-22._

## Out of scope (v1)

- Per-log privacy or leaderboard opt-in setting (profile private flag is sufficient).
- Separate period picker inside drawer.
- All-time default on rank feeds (default remains **month**).
- Native app surfaces.
- Rewards/badges for winning a period.
