# Sense — Watchlist hero, continue rail, and platform morph filters

**Status:** Design approved (brainstorm 2026-09-23) — replaces watchlist **IA** from [`2026-09-23-watchlist-decision-engine-design.md`](./2026-09-23-watchlist-decision-engine-design.md); scoring, alerts, and `PATCH /alert` stay.
**Date:** 2026-09-23
**Topic:** `/watchlist` as a single scroll: Netflix-style **Tonight hero** with **Pick another**, **Continue watching** rail, sort chips + **filters popover**, **platform logo row** with morph-into-pill streaming filter, then poster catalogue.

## Summary

Patrons land on **one watchlist page** — not six equal “modes.” **Watch tonight** is always the lead **hero** (Today’s Pick–style rotation). **Continue watching** sits beneath when they have in-progress TV. **Recently added · Oldest saves · By title** sort the saves grid. **Streaming by service** is chosen from **large platform cards** (Netflix, Apple TV+, …); each selection **morphs** into a **composite pill** beside the **filters** button (stacked logo circles + service names). The grid shows only titles **on all selected services** in the patron’s **chosen watch region** (AND). Region and legacy “now available” affordances live in the **filters popover** (home parity), not as top-level chips.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Tonight | **Hero** with **Pick another** among top ranked saves (~8–12 pool); not a sort chip or full-page ranked grid |
| Continue | Section under hero; **hidden** when no `tv_watch` in progress |
| Sort chips | **Recently added** (default) · **Oldest saves** · **By title** only |
| Now available | **Not** a chip; region + streaming notes in **filters popover** (right), like `/home` |
| Platform row | Large rounded **logo cards** under filter row (Mobbin/Netflix row idiom) |
| First platform tap | Card **morphs** → pill (circle logo + name) **animates** to slot **beside filter button** |
| More platforms | **Same pill** gains **stacked logo circles** + **names side by side** inside one pill |
| Row vs pill | Selected providers **leave** the big row (no duplicate pick) |
| Remove services | **Tap pill** → popover: list with **Remove** per service + **Clear all**; last remove dissolves pill (optional return-to-row animation) |
| Multi-provider filter | **AND** — title must flatrate on **every** selected provider in region |
| Region | Required for platform row + AND filter to apply; unset → inline **Choose region** (popover + quiet hero note), no fake US list |
| Alerts / Attuned | Unchanged: per-title alert on toolkit, preview dialog, job gating |

## Page layout (top → bottom)

```
┌ HomeStickyChrome ─────────────────────────────────────────┐
│ Tonight hero (backdrop, reason, actions, Pick another)     │
├───────────────────────────────────────────────────────────┤
│ Or continue watching — horizontal poster rail (if any)       │
├───────────────────────────────────────────────────────────┤
│ [Recent · Oldest · A–Z]     [◉◉ Netflix Apple TV+ pill][⚙] │
├───────────────────────────────────────────────────────────┤
│ ┌ Netflix ┐ ┌ Apple TV+ ┐ ┌ MUBI ┐ …  (horizontal scroll)│
├───────────────────────────────────────────────────────────┤
│ Poster catalogue (infinite grid, sort + provider AND)      │
└───────────────────────────────────────────────────────────┘
```

- **Unsigned:** hero + continue hidden or signed-in-only; grid/marketing TBD — v1 **signed-in only** for hero/platform morph (same as current watchlist).
- **Empty watchlist:** hero empty state + **Browse films**; hide platform row and provider pill; sort chips may still show empty grid copy.

## Tonight hero

- **Data:** Reuse `GET /api/watchlist?order=tonight&limit=N` (or dedicated `GET /api/watchlist/tonight-pick` returning `{ pool, spotlight }` if cleaner). Server ranker unchanged (`watchlist-tonight-score.ts`).
- **UI:** Reuse **`HomeTasteMatchedHero`** presentation patterns where possible (`HomeLobbyTasteTrailerBackground`, logo, reason line, Quick log, watchlist toggle) with **`completionMode`** suited to watchlist (no Today shell events unless product wants `today.*` parity — **out of scope**; use `watchlist.hero_*` analytics).
- **Pick another:** Client cycles pool index; no URL change; consumed picks optional v2 (**out of scope** v1).
- **Empty / error:** Honest copy; no rotating placeholders.

## Continue watching

- **Data:** `GET /api/tv-watch/me` (`watching` \| `rewatching`), same as current `order=continue` page branch.
- **UI:** Reuse **`HomeContinueWatchingRail`** (heading may read **Or continue watching** for watchlist context).
- **Empty:** **Omit section** entirely (no rail, no blurb).

## Filter row

- **Left:** `SegmentedPillToolbar` — `latest_added` · `earliest_added` · `title_az`; default **`latest_added`**; `?order=` unchanged for these three.
- **Right:** **`WatchlistCatalogFiltersPopover`** (new, modeled on **`HomeCatalogFiltersPopover`**):
  - **Streaming region** (reuse **`CatalogWatchRegionPrompt`** flow)
  - **Release / availability copy** for “what counts as streaming here” (not a duplicate platform picker)
  - Plan-gated **watchlist alerts** hint if needed (Settings parity)
- **Composite provider pill slot:** immediately **left of** filter trigger; empty until first platform selection.

## Platform row

- **Contents:** Providers that appear as **flatrate on ≥1 watchlist title** in the patron’s **chosen region**, ordered by count desc then name. Cap visible cards (e.g. 12) with horizontal scroll + edge fades (`useHorizontalScrollFades`).
- **Card chrome:** Large rounded tile, provider logo (TMDb or themed asset), optional save count badge (“12 saves”) — v1 logo + name sufficient.
- **Interaction:** Tap card → shared-element style morph (`motion/react`, `layoutId` per provider); **`prefers-reduced-motion`** → instant pill appear in slot, no flight path.
- **Deselect from row:** Not available for active providers (card absent); re-add via popover **Clear all** / future “Add service” in popover v2 (**optional**).

## Composite provider pill

- **Structure:** One `rounded-full` **`bg-background`** track (chip family); leading **stacked circles** (max ~4 visible + **+N**); trailing **names** truncated with middle dot or comma join.
- **Popover (tap pill):** Rows: logo, name, **Remove**; footer **Clear all**; removing last provider animates pill away and restores card in row.
- **URL:** `?providers=8,350` (comma-separated **TMDb provider ids**, stable order). Empty param = no AND filter. Sync with pill state on load (deep link).

## Catalogue grid

- **Default:** All saves for current `?order=` (hide-watched rules unchanged).
- **With `?providers=`:** Server filters to titles with flatrate **for every** listed provider in **chosen region** (AND). Pagination on filtered set.
- **Sort + AND:** Both apply — e.g. “Recently added, on Netflix **and** Apple TV+.”
- **Tiles:** Title on scrim for save sorts; when AND active, optional subtitle “Netflix · Apple TV+” only if room — v1 keep title-only scrim to avoid clutter.

## API changes

| Change | Detail |
|--------|--------|
| `GET /api/watchlist` | Query `providers=8,350` (repeat or comma list). Validate ids; AND match via existing provider projection per region. `order=tonight` still used **only** for hero prefetch, not main grid default. |
| `GET /api/watchlist/providers` (new, optional) | Returns distinct `{ providerId, providerName, logoPath, titleCount }[]` for row — avoids scanning full list client-side. If omitted, derive from page-1 scan + cache 60s. |
| Deprecate UI for | `?order=tonight`, `?order=continue`, `?order=available` as **page** navigations — redirect: `tonight`/`continue` → `/watchlist`; `available` → `/watchlist` + open filters popover once. |

## Client architecture

- **`watchlist/layout.tsx`:** Shell holds filter row + platform row + pill slot (persistent across grid Suspense).
- **`watchlist/page.tsx`:** Parallel RSC: hero data, continue bundles, grid page 1 with `order` + `providers`.
- **`WatchlistTonightHero`:** Client island (pick rotation).
- **`WatchlistPlatformRow` + `WatchlistProviderFilterPill`:** Client; URL sync via `useLobbyNavigation` / searchParams.
- Remove **`WatchlistCatalogOrderChips`** entries for tonight / continue / available; remove **`WatchlistModeIntroLine`** mode copy tied to six chips.

## Motion & a11y

- One **`layoutId`** per provider for card ↔ pill; pill position uses filter-row anchor ref.
- Pill and cards: min 44px touch targets; popover focus trap; ESC closes.
- Screen reader: pill announces “Streaming filter: Netflix and Apple TV+”; platform row as listbox or group of buttons.

## Instrumentation

| Kind | Properties |
|------|------------|
| `watchlist.hero_viewed` | `has_pick`, `reason_kind` |
| `watchlist.hero_action` | `pick_another`, `open_detail`, `quick_log`, … |
| `watchlist.provider_selected` | `provider_id`, `stack_depth` |
| `watchlist.provider_removed` | `provider_id`, `clear_all` |
| `watchlist.mode_viewed` | **`order` only** (`latest_added` \| …); add `providers_count` |
| Existing | `watchlist.tile_action`, alerts, upgrade prompt unchanged |

## Testing

- Hero: pool size 0/1/N; pick another wraps.
- Continue: hidden vs rail with next-episode labels.
- Morph: reduced motion instant path.
- AND filter: 0/1/2 providers; title on A only excluded when A+B selected; region unset blocks filter.
- URL: `?providers=` round-trip; invalid id ignored.
- Redirects from legacy `?order=tonight|continue|available`.

## Out of scope (v1)

- Hero **Not interested** / taste exclusion.
- OR provider mode, rent/buy in platform row.
- Dedicated `/watchlist/tonight` route.
- Replacing Today on Sense hero — watchlist hero is **watchlist-only**.

## Related / superseded

- **Keeps:** [`2026-09-23-watchlist-decision-engine-design.md`](./2026-09-23-watchlist-decision-engine-design.md) — scorer, alerts, migration 0046, continue **data** model.
- **Supersedes (IA):** six equal mode chips; ranked **grid** as Watch tonight; **Continue** and **Now available** as chips; default first paint **`order=tonight`** as full wall.

## As built

_(Empty until implementation.)_
