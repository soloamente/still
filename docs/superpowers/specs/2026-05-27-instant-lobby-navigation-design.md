# Instant Lobby Navigation — Perceived Performance

**Status:** Approved (brainstorm 2026-05-27; approach **A** + streaming supplement **C**)  
**Date:** 2026-05-27  
**Scope:** App-wide in-page filters (chips, tabs, venue, order, period) on lobby and detail routes  
**Out of scope (v1):** Removing `force-dynamic` globally, service worker/offline, full TanStack Query data layer, virtualizing huge diary grids

## Summary

Patrons experience a **frozen full page** when tapping filter chips (e.g. diary **In cinemas / At home**, profile **Movies / TV / venue**) because navigation uses `<Link href="?...">` against **`force-dynamic`** RSC pages that await **all** data before returning HTML. The fix is an **Instant Lobby** pattern: hoist patron-owned datasets into a **client shell**, derive the visible grid locally, and drive chip changes with **`useTransition` + `router.replace(..., { scroll: false })`** so chips and grid update on the next frame while the URL stays shareable. TMDb catalogue lobbies (`/home` Movies/TV) use the same chip behaviour but keep server fetches, with a **grid-only pending overlay** and Suspense streaming instead of client-side filtering.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Primary approach | **A — Instant Lobby Shell** (client filter + transition navigation) |
| Supplement | **C — Streaming RSC** (Suspense boundaries, route `loading.tsx`) on heavy routes |
| URL behaviour | **Instant UI first** — optimistic chip state, then `router.replace` in the same transition; `scroll: false` |
| Filter controls | Same-pathname query changes **must not** use `<Link>`; use shared `navigate()` |
| Data layer v1 | RSC fetch once → pass props to client shell; **no** app-wide React Query yet |
| React Query | Defer until mutation invalidation pain is clear (log edit, follow, etc.) |
| Existing helpers | Reuse all `parse*` / `build*Href` / `*Matches*Venue` / sort functions unchanged |
| Chip UI precedent | `HomeCommunityPeriodToolbar` (`SegmentedPillToolbar` + `router.replace`), `HomeLobbySessionRestore` (`scroll: false`, avoid unnecessary RSC) |

## Problem

1. **`(app)` routes** overwhelmingly use `export const dynamic = "force-dynamic"` and a single top-level `async` page component.
2. **Filter chips** are `<Link>` navigations that re-run the full server component.
3. **No inner Suspense** on most lobbies — sticky chrome, chips, and grid share one await barrier.
4. **`loading.tsx`** on profile does not help **query-only** navigations; Next keeps the previous screen until the new RSC payload is ready → symptom **B** (whole page frozen).
5. **Diary** re-fetches `GET /api/logs/me` on every `?venue=` change even though filtering is pure in-memory server-side.

## Goal

| Interaction | Target perceived behaviour |
|-------------|----------------------------|
| In-page filter (venue, tab, order, period) | Chips active **&lt;100ms**; grid updates same frame when data is client-derived |
| URL | Updates in the same gesture; refresh/share/back remain correct |
| Route change (e.g. diary → film detail) | May stay server-driven; show pending affordance, not frozen chips |
| TMDb `/home` sort/venue/run | Chips instant; grid shows **local** pending overlay, optional stale grid underneath |

## User stories

1. On `/diary`, I tap **In cinemas** and the chip and poster grid update immediately without the page feeling stuck.
2. On `/profile/@me`, I switch **Movies → TV** or **At home → In cinemas** with the same instant feedback.
3. On `/watchlist`, order/venue chips (if present) do not freeze the shell.
4. On `/home` Movies, changing sort or venue moves the chip immediately; the catalogue grid shows a brief pending state instead of freezing search/chrome.
5. I copy a URL with `?venue=theaters`, open it in a new tab, and see the correct slice on first paint (RSC initial state).
6. I use browser **Back** after changing venue; the grid matches the URL without a full-page freeze.

## Architecture

### Primitives (`apps/web/src/lib/` + `apps/web/src/components/lobby/`)

| Primitive | Responsibility |
|-----------|----------------|
| **`useLobbyTransition()`** | `useTransition` + `router.replace(href, { scroll: false })`; returns `{ isPending, navigate }` |
| **`LobbyFilterChip` / chip rows** | Optimistic active state; call `navigate(build*Href(...))` on select — not `<Link>` |
| **`PatronLobbyShell`** | Generic client wrapper: `searchParams` → parse helpers → `useMemo` filter/sort → grid children |
| **`LobbyGridPendingOverlay`** | Absolute overlay on grid region when `isPending` and server fetch required |

### Page shape

```
RSC page (thin)
  ├─ auth + single fetch (logs / profile / watchlist)
  ├─ serialize props → PatronLobbyShell
  └─ optional Suspense for slow blocks (badges, community feed)

PatronLobbyShell ("use client")
  ├─ initial params from RSC + useSearchParams() for back/forward
  ├─ optimistic chip state on tap → navigate() in startTransition
  ├─ grid = useMemo(filter/sort from cached rows)
  └─ router.refresh() only after mutations (later phase)
```

### Rules

1. **Same pathname + query-only change** → client derivation when full dataset is already on the client.
2. **Pathname change** or **TMDb infinite catalogue** → server fetch allowed; chips still use `navigate()` + `isPending` overlay on grid only.
3. Do not use `window.history.replaceState` alone for filters (breaks `useSearchParams` sync); use `router.replace` inside transition.
4. Preserve existing URL tokens (`theaters` / `streaming`, `?order=`, `?tab=`, `?run=`, `?period=`).

## Route tiers & rollout

### Phase 1 — Patron-owned lobbies (Tier 1)

| Route | Client shell | Hoisted data | Chips migrated |
|-------|--------------|--------------|----------------|
| `/diary` | `DiaryPatronLobbyShell` | `fetchMyLogsMeServer` rows | `DiaryCatalogOrderChips`, venue via `HomeCatalogViewModeToolbar` diary branch |
| `/profile/[handle]` | `ProfilePatronLobbyShell` | `recentlyWatched`, lists, reviews, tab metadata | `ProfileTabToolbar`, `ProfileCatalogOrderChips`, `ProfileCatalogVenueChips` |
| `/watchlist` | `WatchlistPatronLobbyShell` | watchlist seeds | order chips as applicable |

**Phase 1 success criteria**

- Manual: venue/tab toggle on diary and profile — no full-page freeze; chip animates immediately.
- `bun run build` in `apps/web` passes.
- Initial load with `?venue=theaters` still renders correct slice from RSC props.

### Phase 2 — Community & order chips (Tier 2)

| Route | Strategy |
|-------|----------|
| `/home?browse=community` | Client-filter period/feed where payload is already loaded; migrate period toolbar pattern to `useLobbyTransition` |
| `/diary`, `/profile` | `?order=` handled inside existing shell (pure sort) |

### Phase 3 — TMDb catalogue (Tier 3)

| Route | Strategy |
|-------|----------|
| `/home` movies/TV | Chips via `navigate()`; wrap `PopularMoviesInfinite` in Suspense; `LobbyGridPendingOverlay` when `isPending`; prefetch on chip hover; keep previous grid at reduced opacity until new data arrives |

### Phase 4 — Detail routes (Tier 4, streaming only)

| Route | Strategy |
|-------|----------|
| `/movies/[id]`, `/tv/[id]`, `/lists/[id]` | Split hero vs tab panels with Suspense; query-backed tabs use `useLobbyTransition` |

## Component migration notes

### Diary (`apps/web/src/app/(app)/diary/page.tsx`)

- RSC: fetch logs + profile prefs once; pass `rawRows`, `monochromePeersOnHover`, `signedIn`.
- Move filter/sort/grid into `DiaryPatronLobbyShell` using `diaryLogMatchesDiaryLobbyVenue`, `sortDiaryLobbyRowsForOrder`, `buildDiaryLobbyGridItems`.
- Consider splitting `catalogueWaveKeyOverride` so venue-only changes do not remount every poster (order change may still wave).

### Profile (`apps/web/src/app/(app)/profile/[handle]/page.tsx`)

- RSC: fetch profile payload once; pass filmography, social tab data, badges (badges may stay Suspense child).
- Shell owns `resolveProfileTab`, venue filter, favorites filter, grid items.
- Header/milestones remain outside shell or in static RSC children above shell.

### Home venue/sort chips (`home-catalog-view-mode-toolbar.tsx`, `home-catalog-sort-chips.tsx`)

- Phase 3: replace `<Link>` with `navigate()` for in-page query changes.
- Phase 1–2: no change until Tier 3.

## URL, history, and hydration

1. **First paint:** RSC reads `searchParams`, passes `initialVenue` / `initialTab` / `initialOrder` to shell.
2. **Chip tap:** set optimistic param state → `navigate(buildHref)` in `startTransition`.
3. **`scroll: false`** on all filter `replace` calls.
4. **popstate / back:** `useSearchParams()` updates; shell re-runs `useMemo` derive — no refetch.
5. **Hard refresh / shared link:** RSC props match URL; client hydrates without flash of wrong slice.

## UX

- Chips: always interactive; active pill uses existing `motion` `layoutId` patterns.
- Grid (client-derivable): cross-fade or instant swap; respect `prefers-reduced-motion`.
- Grid (server fetch): overlay skeleton on **grid region only**; sticky search/chrome stay live.
- Empty states: derive from filtered `gridItems.length` client-side (same copy as today).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Large diary (1000+ logs) in client memory | Rely on existing API cap; monitor; virtualize in follow-up if needed |
| Stale grid after log edit | Call `router.refresh()` on successful PATCH from quick log (Phase 2 polish) |
| Profile SEO | RSC still emits HTML for default tab; meaningful title unchanged |
| Duplicate fetch on first load + transition | Transition should not refetch when shell already holds full dataset |
| `framer-motion` vs `motion/react` in toolbar | Migrate touched chip files to `motion/react` when editing |

## Testing

| Check | Phase |
|-------|-------|
| Manual diary venue × order matrix | 1 |
| Manual profile tab × venue × favorites | 1 |
| Manual watchlist chips | 1 |
| `bun run build` (`apps/web`) | each phase |
| Optional Playwright: diary venue chip not blocked | 1 if cheap |

## References

- `apps/web/src/app/(app)/diary/page.tsx` — current full RSC + refetch pattern
- `apps/web/src/app/(app)/profile/[handle]/page.tsx` — full profile await
- `apps/web/src/components/home/home-community-period-toolbar.tsx` — `router.replace` precedent
- `apps/web/src/components/home/home-lobby-session-restore.tsx` — URL update without RSC when safe
- `apps/web/src/lib/diary-lobby-order.ts`, `profile-lobby-order.ts` — pure filter/sort helpers
