# Sense — Listing engagement stats (movie / TV detail)

**Status:** Approved (2026-06-16) — brainstorm locked  
**Date:** 2026-06-16  
**Topic:** Letterboxd-style engagement chips (watched · lists · favorited · watchlist) with in-page drawers  
**Parent:** Movie/TV detail hero — extends [`listing-community-stats.ts`](../../../apps/server/src/lib/listing-community-stats.ts)  
**Reference:** Letterboxd title page stats row (eye · grid · heart) + member/review drawers

## Summary

Add a **four-chip engagement row** under the community score laurel on movie and TV detail: **Watched**, **Lists**, **Favorited**, **Watchlist**. Each chip shows an abbreviated count (including **0**), a hover tooltip with the exact total, and opens a **`DetailVaulSheet`** drawer listing patrons or lists the viewer can see — without leaving the title page.

Replaces the current prose line (`12 watches · 8 on watchlists`) in `MovieDetailCommunityRatingHero` `variant="compact"`.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Chips | **Watched · Lists · Favorited · Watchlist** (four) |
| Placement | Below laurel score, above `N public ratings` line |
| Zero state | Chips **always visible**, including **0** (Letterboxd-style) |
| Chip counts | **Watched** — distinct patrons with any non-removed diary log; **Lists** — all `list_item` rows on non-removed lists (incl. private); **Favorited** — distinct patrons with `log.liked = true`; **Watchlist** — all `watchlist_item` rows |
| Interaction | Tap chip → **`DetailVaulSheet`** in-page drawer |
| Drawer rows | Only content **visible to the signed-in viewer** (`content_visibility`, public profile, `canViewList`) |
| Lists drawer | Public lists + own private + collaborator lists (`canViewList`) — not other patrons' private list titles |
| Chip vs drawer gap | Chip may exceed drawer row count (private logs/lists); drawer footer shows aggregate-only note, no private patron names |
| Hover | Tooltip with exact count copy (e.g. “Watched by 1,537 patrons”) |
| Surfaces | **`/movies/[id]`** and **`/tv/[id]`** `(app)` — movie + TV parity |
| Signed-out | Chips hidden (drawers require session); public share shells unchanged |
| Phasing | **1a** chip row + counts on detail GET; **1b** tappable drawers + paginated engagement routes |

## Problem

Sense shows community **score** but not the broader **social volume** Letterboxd patrons expect (how many watched, listed, favorited, watchlisted). The existing engagement meta line is easy to miss, not tappable, and hides counts below a threshold of 3.

## Architecture

```text
GET /api/movies|tv/:id
  → community.{ watchesCount, listsCount, favoritesCount, watchlistCount }
  → always number ≥ 0 (no null threshold)

Hero (RSC)
  → MovieDetailCommunityRatingHero passes counts to MovieDetailEngagementChips (client)

Chip tap (client, signed-in)
  → opens MovieDetailEngagementDrawer(kind)
  → GET /api/movies|tv/:id/engagement/:kind?page=&limit=
  → paginated rows, visibility-filtered
```

**Reuse:** `DetailVaulSheet`, `DetailDrawerScrollBody`, `PatronPortraitWithMetalTier`, existing review reader open path for watch rows with reviews.

## API contracts

### Extended `community` on `GET /api/movies/:id` and `GET /api/tv/:id`

```ts
community: {
  averageRating: number | null;
  ratingsCount: number;
  watchesCount: number;
  listsCount: number;
  favoritesCount: number;
  watchlistCount: number;
}
```

Remove `LISTING_COMMUNITY_ENGAGEMENT_MIN_COUNT` gating — counts are always `number >= 0`.

### `GET /api/movies/:id/engagement/watches` (and TV twin)

- **Auth:** signed-in (401 unsigned)
- **Query:** `page`, `limit` (default 20, max 50)
- **Response:**

```ts
{
  items: Array<{
    userId: string;
    handle: string;
    displayName: string;
    image: string | null;
    avatarIsAnimated: boolean;
    diaryMetalTier: DiaryMetalTier | null;
    rating: number | null;       // stored tenths; client decodes
    liked: boolean;
    watchedAt: string;
    review: {
      id: string;
      headline: string | null;
      body: string;
      rating: number | null;
      likesCount: number;
      publishedAt: string;
    } | null;
  }>;
  page: number;
  hasMore: boolean;
  totalVisible: number;
  totalGlobal: number;         // matches watchesCount chip
}
```

- **Logic:** latest log per visible patron; join optional published review when `contentVisibilityWhere` allows; exclude private profiles; order by `watchedAt` desc.

### `GET /api/movies/:id/engagement/lists`

- **Auth:** signed-in
- **Response items:** list cards the viewer can open (`canViewList`): id, title, ownerHandle, likesCount, cover, `isPublic`, item position note
- **Order:** `likesCount` desc, `updatedAt` desc
- **Counts:** `totalVisible` vs `totalGlobal` (chip)

### `GET /api/movies/:id/engagement/favorites`

- **Auth:** signed-in
- **Items:** patrons with visible `log.liked = true` (latest log per patron), avatar + handle + optional rating
- **Order:** `watchedAt` desc on favoriting log

### `GET /api/movies/:id/engagement/watchlist`

- **Auth:** signed-in
- **Items:** patrons with public profile who have the title on watchlist (no private profile leak)
- **Order:** `addedAt` desc on watchlist row

TV routes mirror movie routes with `tvId` scoping (`log.tvId`, `list_item.tvId`, `watchlist_item.tvId`).

## UI

### `MovieDetailEngagementChips`

| Chip | Icon (Nucleo) | Abbrev | Tooltip |
|------|-----------------|--------|---------|
| Watched | Eye / view | `1.5M` | Watched by {n} patrons |
| Lists | Grid / list | `186K` | Appears in {n} lists |
| Favorited | Heart filled | `504K` | Favorited by {n} patrons |
| Watchlist | Bookmark / clock | `12K` | On {n} watchlists |

- Row: `flex` centered, `gap-4`, icon + `tabular-nums` muted label
- **`@media (hover: hover)`** tooltip via `title` + accessible description
- Chip is a `<button>`; disabled styling when count is 0 still tappable (empty drawer)

### `MovieDetailEngagementDrawer`

- **`DetailVaulSheet`** `rounded-t-[2.25rem]` parity with review reader
- Title per kind: “Watched by patrons”, “Lists with this title”, etc.
- Scroll body + bottom scrim (`DetailDrawerScrollBody`)
- Footer when `totalVisible < totalGlobal`: “{visible} patrons you can see · {delta} more with private activity” (copy helper — no names)
- **Watched row:** avatar, name, score, review excerpt; tap review → existing reader; tap avatar → profile
- **Lists row:** reuse list card chrome from community tab (cover, title, @handle)
- **Favorites / Watchlist row:** avatar row similar to following-ratings rail

### Placement in `MovieDetailCommunityRatingHero`

```text
[ laurel score laurel ]
[ eye 1.5M  grid 186K  heart 504K  bookmark 12K ]  ← new chips
[ 47 public ratings ]
```

Hide chip row when unsigned. Hide entire engagement section only when no score and all counts are 0 (optional — prefer always show chips for signed-in).

## Privacy & safety

| Data | Chip (global) | Drawer (viewer-scoped) |
|------|---------------|-------------------------|
| Diary logs | All patrons | `contentVisibilityWhere` + public profile |
| Reviews | N/A | Same visibility as reviews tab |
| Lists | All list_item rows | `canViewList` only |
| Favorites | All `log.liked` | Visible logs only |
| Watchlist | All rows | Public profiles only |

Never return private list titles or private diary bodies to non-owners.

## Testing

- **Server:** `listing-community-stats.test.ts` — four counts, zero titles, TV parity
- **Server:** `listing-engagement-query.test.ts` — visibility filtering, pagination, totalVisible vs totalGlobal
- **Server:** route tests 401 unsigned, happy path mocked db
- **Web:** `format-engagement-count.ts` abbrev (`999`, `1.2K`, `1.5M`)
- **Web:** chip tooltip copy tests

## Out of scope

- Histogram / rating distribution (roadmap locked: no histogram)
- Export or SEO exposure of engagement drawers
- Following-only sort in watched drawer (deferred; default recent)
- Watchlist/favorite notifications

## Related docs

- Plan: [`2026-06-16-listing-engagement-stats.md`](../plans/2026-06-16-listing-engagement-stats.md)
- Presence (orthogonal): [`2026-06-16-listing-presence-design.md`](./2026-06-16-listing-presence-design.md)
