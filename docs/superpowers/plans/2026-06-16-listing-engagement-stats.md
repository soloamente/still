# Listing Engagement Stats (Movie / TV Detail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Letterboxd-style **Watched · Lists · Favorited · Watchlist** chips under the community score on movie/TV detail, with tappable **`DetailVaulSheet`** drawers listing visible patrons/lists.

**Architecture:** Extend `fetchListingCommunityEngagementStats` for four always-on counts on `GET /movies|tv/:id`. Add paginated `GET …/engagement/:kind` routes with viewer-scoped rows. Client: `MovieDetailEngagementChips` + `MovieDetailEngagementDrawer` wired into `MovieDetailCommunityRatingHero`.

**Tech Stack:** Drizzle/Neon, Elysia, Next.js client components, `DetailVaulSheet`, `bun:test`.

**Spec:** [`docs/superpowers/specs/2026-06-16-listing-engagement-stats-design.md`](../specs/2026-06-16-listing-engagement-stats-design.md)

---

## Conventions

- Counts always `number >= 0` — remove `LISTING_COMMUNITY_ENGAGEMENT_MIN_COUNT` null gating
- Abbrev formatter: `formatEngagementCountAbbrev(n)` → `0`, `999`, `1.2K`, `1.5M`
- Drawer pagination: `page` 1-based, `limit` default 20 max 50
- TV parity on every movie route/query
- Tests: `bun:test`; human **`go`** between tasks
- Do **not** commit unless the human asks
- After code changes: `graphify update .`

---

## Milestone 1a — Chip row + counts (no drawers)

### Task 1: Extend engagement stats lib

**Files:**
- Modify: `apps/server/src/lib/listing-community-stats.ts`
- Modify: `apps/server/src/lib/listing-community-stats.test.ts`

- [ ] **Step 1:** Add `listsCount` (`list_item` ⋈ `list`, `removedAt` null) and `favoritesCount` (`countDistinct log.userId` where `liked = true`)
- [ ] **Step 2:** Change `watchesCount` to distinct patrons on **any** log (drop `visibility = public` filter)
- [ ] **Step 3:** Remove `publicListingEngagementCount` / min-3 null — return raw non-negative ints
- [ ] **Step 4:** Tests — empty title all zeros; mixed movie logs; TV `tvId` parity
- [ ] **Step 5:** Run `cd apps/server && bun test src/lib/listing-community-stats.test.ts`

**Success criteria:** All four counts returned as numbers; tests pass.

---

### Task 2: Wire counts through movie/TV GET

**Files:**
- Modify: `apps/server/src/routes/movies.ts`
- Modify: `apps/server/src/routes/tv.ts`
- Modify: `apps/web/src/app/(app)/movies/[id]/page.tsx`
- Modify: `apps/web/src/app/(app)/tv/[id]/page.tsx`

- [ ] **Step 1:** Ensure `community` spread includes `listsCount`, `favoritesCount`
- [ ] **Step 2:** Update `CommunityShape` types on web pages
- [ ] **Step 3:** Pass four counts into `MovieDetailCommunityRatingHero`

**Success criteria:** API JSON includes four counts; pages compile.

---

### Task 3: Abbrev + tooltip copy helpers

**Files:**
- Create: `apps/web/src/lib/format-engagement-count.ts`
- Create: `apps/web/src/lib/format-engagement-count.test.ts`
- Create: `apps/web/src/lib/listing-engagement-chip-copy.ts`
- Create: `apps/web/src/lib/listing-engagement-chip-copy.test.ts`

- [ ] **Step 1:** `formatEngagementCountAbbrev` + tests (`0`, `42`, `999`, `1000`, `1537609`)
- [ ] **Step 2:** Tooltip strings per kind (watched/lists/favorited/watchlist)
- [ ] **Step 3:** Run web copy tests

**Success criteria:** Copy tests pass.

---

### Task 4: Engagement chips UI

**Files:**
- Create: `apps/web/src/components/movie/movie-detail-engagement-chips.tsx`
- Modify: `apps/web/src/components/movie/movie-detail-community-rating-hero.tsx`

- [ ] **Step 1:** Build four-chip row (Nucleo icons, abbrev, `title` tooltip, `aria-label`)
- [ ] **Step 2:** Replace `formatListingEngagementMetaLine` prose with `<MovieDetailEngagementChips />`
- [ ] **Step 3:** Hide chips when unsigned (prop `signedIn` from page)
- [ ] **Step 4:** Chips render at `0`; buttons no-op until Task 6 (or `disabled` with `aria-disabled` until drawers ship)

**Success criteria:** Hero shows chip row under score; no prose watches line; visual check `/movies/[id]`.

**Human verify milestone 1a** before Task 5.

---

## Milestone 1b — Drawers + engagement routes

### Task 5: Engagement query lib

**Files:**
- Create: `apps/server/src/lib/listing-engagement-query.ts`
- Create: `apps/server/src/lib/listing-engagement-query.test.ts`

- [ ] **Step 1:** `fetchListingEngagementWatches({ movieId|tvId, viewerId, page, limit })` — latest log per patron, `contentVisibilityWhere`, public profile, optional review join
- [ ] **Step 2:** `fetchListingEngagementLists` — `canViewList` filter, reuse list card fields
- [ ] **Step 3:** `fetchListingEngagementFavorites` — visible `log.liked` rows
- [ ] **Step 4:** `fetchListingEngagementWatchlist` — public profile patrons on watchlist
- [ ] **Step 5:** Each returns `{ items, page, hasMore, totalVisible, totalGlobal }`
- [ ] **Step 6:** Unit tests with mocked rows / visibility edges

**Success criteria:** Query tests pass without DB in unit layer (inject rows or test pure mappers).

---

### Task 6: Elysia engagement routes

**Files:**
- Create: `apps/server/src/routes/listing-engagement.ts`
- Create: `apps/server/src/routes/listing-engagement.test.ts`
- Modify: `apps/server/src/server/app.ts` (mount)

- [ ] **Step 1:** `GET /api/movies/:id/engagement/watches|lists|favorites|watchlist`
- [ ] **Step 2:** TV twins under `tvRoute` or shared helper
- [ ] **Step 3:** 401 unsigned; 400 invalid id; happy path
- [ ] **Step 4:** `bun test src/routes/listing-engagement.test.ts`

**Success criteria:** Route tests pass.

---

### Task 7: Web fetch + drawer shell

**Files:**
- Create: `apps/web/src/lib/fetch-listing-engagement.ts`
- Create: `apps/web/src/components/movie/movie-detail-engagement-drawer.tsx`
- Create: `apps/web/src/components/movie/movie-detail-engagement-drawer-rows.tsx`

- [ ] **Step 1:** Typed fetch helpers per kind with cookie credentials
- [ ] **Step 2:** `MovieDetailEngagementDrawer` — `DetailVaulSheet`, kind prop, infinite scroll or load-more
- [ ] **Step 3:** Row components: watch (review excerpt + open reader), list card, patron row
- [ ] **Step 4:** Footer copy when `totalVisible < totalGlobal`

**Success criteria:** Drawer opens from chip; loads first page; scroll works.

---

### Task 8: Wire chips → drawers

**Files:**
- Modify: `apps/web/src/components/movie/movie-detail-engagement-chips.tsx`
- Modify: `apps/web/src/components/movie/movie-detail-community-rating-hero.tsx`

- [ ] **Step 1:** Local state `engagementDrawerKind` in hero or chips parent
- [ ] **Step 2:** Chip tap opens drawer with `listingKind`, `listingId`, `kind`
- [ ] **Step 3:** Empty states per kind at count 0

**Success criteria:** Full flow on movie + TV detail without route change.

---

### Task 9: Verification + docs

**Files:**
- Modify: `.cursor/scratchpad.md`
- Modify: `AGENTS.md` (engagement chips one-liner under Movie detail)

- [ ] **Step 1:** Run server + web test bundle for engagement files
- [ ] **Step 2:** Manual QA — chip tooltips, four drawers, private gap footer, review tap from watched drawer
- [ ] **Step 3:** Update scratchpad; `graphify update .`

**Success criteria:** Tests green; human **`ok`** on manual QA.

---

## Manual QA checklist

1. Signed-in movie detail — four chips under score, `0` when new title
2. Tooltip shows exact count on hover (desktop)
3. Watched drawer — patrons + review excerpts; private patrons aggregated only in footer
4. Lists drawer — only lists you can open; tap → list detail
5. Favorited / Watchlist drawers — avatar rows; profile links work
6. TV detail parity
7. Signed-out / share shell — chips hidden
