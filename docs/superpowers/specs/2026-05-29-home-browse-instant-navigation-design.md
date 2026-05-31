# Home Browse Instant Navigation — Perceived Performance

**Status:** Approved (brainstorm 2026-05-29; human **va bene**; extends [Instant Lobby Navigation](./2026-05-27-instant-lobby-navigation-design.md))  
**Date:** 2026-05-29  
**Scope:** `/home` top-level **Movies · TV Shows · Community** browse tabs and Community data loading  
**Out of scope (v1):** Removing `force-dynamic` globally, TanStack Query, unified leaderboard API, virtualizing Community feeds, parallel `@slot` routes, prefetching full Community bundle on every `/home` mount

## Summary

Patrons report a **frozen full page** when switching **Movies / TV Shows / Community** on `/home`: the browse pill does not move until the RSC payload finishes. **Community** is worst because `home/page.tsx` awaits lists, reviews, feed, and **eight** leaderboard requests before any HTML updates. Instant Lobby Phases 1–4 (2026-05-27) fixed **in-lobby** chips (venue, period, detail tabs) but **not** the browse-surface toolbar in `HomeStickyChrome`, which still uses `router.push` without optimistic state.

This spec extends approach **A + C** from Instant Lobby: **optimistic browse pill + `useLobbyTransition`** for all three surfaces, **body gate** so the catalogue area does not show the wrong lobby during pending navigation, and **Community core-first loading** with leaderboard fetch deferred to a client background fill.

## Confirmed symptoms (human QA 2026-05-29)

| Observation | Detail |
|-------------|--------|
| Browse pill freeze | **A** — pill stays on previous tab until load completes (all surfaces) |
| Relative severity | Movies ↔ TV also frozen; **Community slowest** |
| Prefetch preference | **D** — implementor chooses; **hover + idle prefetch** of Community href, not full mount prefetch |

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Primary approach | Extend **Instant Lobby A** to browse-surface tabs |
| Browse navigation | `router.replace` + `startTransition` on same pathname `/home`; `scroll: false` |
| Browse pill UI | Optimistic `pendingBrowse`; `activeBrowse = pending ?? urlBrowse` |
| Body during pending | `HomeLobbyBodyGate` — skeleton for target surface, not stale grid |
| `LobbyNavigationProvider` | **Single** instance wrapping sticky chrome + catalogue section |
| Community critical path | **Core only** (lists + reviews + feed) in RSC |
| Community leaderboards | **Deferred** — client background fetch after mount; empty/skeleton on Film/TV ranks until ready |
| Community prefetch | `router.prefetch` on Community tab hover; optional `requestIdleCallback` prefetch when still on Movies/TV |
| Cross-route | `/diary` → Community keeps `router.push` with `readHomeLobbyPersisted()` |

## Problem

1. `HomeStickyChrome.pushBrowseSurface` calls `router.push` with no `useTransition` and no optimistic browse state; pill reads only `useSearchParams()`.
2. `home/page.tsx` is one `async` RSC with `dynamic = "force-dynamic"`; browse change re-runs the entire page await barrier.
3. When `browse === "community"`, `Promise.all` includes `fetchHomeLeaderboardsByPeriod` × 2 kinds × 4 periods (**8** HTTP calls) alongside lists, reviews, and feed.
4. No `loading.tsx` on `/home`; Next keeps the previous tree until the new RSC is ready — combined with (1), the UI feels stuck.
5. `LobbyNavigationProvider` is duplicated under `HomeTmdbLobbyChrome` and `HomeCommunityPatronProviders`; browse-level `isPending` does not cover toolbar navigation.

## Goal

| Interaction | Target perceived behaviour |
|-------------|----------------------------|
| Tap Movies / TV / Community | Browse pill active **&lt;100ms**; header/search remain interactive |
| Movies ↔ TV | Pill instant; TMDb grid `lobby-grid-dim-pulse` while RSC pending |
| → Community | Pill + Community chrome instant; **Lists** (default feed) when core ready; ranks skeleton until leaderboards fill |
| Community → Movies/TV | Pill instant; TMDb skeleton or dim until catalogue ready |
| URL | Shareable; refresh opens correct surface from RSC |
| Browser Back | Pill and body match URL without full-page freeze |

## User stories

1. On `/home`, I tap **Community** and the pill moves immediately; I am not staring at a dead UI for multiple seconds.
2. Community opens on **Lists** without waiting for Film/TV rank API calls.
3. I switch **Movies ↔ TV** and the pill updates instantly even if posters take a moment.
4. Hovering **Community** then tapping feels faster than a cold tap (prefetch).
5. I open `/home?browse=community&sort=lists` in a new tab and still see Lists on first paint (RSC core).
6. From `/diary`, tapping **Community** in the sticky bar navigates to `/home` with persisted community sort/period.

## Architecture

### Primitives

| Primitive | Responsibility |
|-----------|----------------|
| **`HomeBrowseSurfaceProvider`** | `activeBrowse`, `selectBrowseSurface`, integrates `useLobbyNavigation().navigate` |
| **`HomeLobbyNavigationRoot`** | Wraps chrome + body with one `LobbyNavigationProvider` |
| **`HomeLobbyBodyGate`** | Renders skeleton vs RSC branch from `activeBrowse`, `urlBrowse`, `isPending` |
| **`CommunityLobbySkeleton`** | Placeholder for feed rows / chip row during pending or core load |
| **`fetchHomeCommunityCore`** | RSC: lists + reviews + feed only |
| **Leaderboard background fill** | Client: populate `filmLeaderboardsByPeriod` / `tvLeaderboardsByPeriod` after mount |

### Provider tree (target)

```
home/page.tsx (RSC)
  HomeLobbyNavigationRoot
    LobbyNavigationProvider
      HomeBrowseSurfaceProvider
        HomeStickyChrome
        HomeLobbyBodyGate
          browse === "community" (url, after RSC)
            Suspense → HomeCommunityRscPayload (core)
              HomeCommunityPatronProviders
          else
            HomeTmdbLobbyChrome + grid
```

### Browse tap sequence

1. `selectBrowseSurface(next)` sets `pendingBrowse = next`.
2. Pill and secondary chips use `activeBrowse` (optimistic).
3. `HomeLobbyBodyGate` shows target skeleton if `pendingBrowse !== urlBrowse`.
4. `navigate(buildHomeLobbyHref(...))` inside `startTransition`.
5. RSC completes → `pendingBrowse` cleared when URL matches.

### `HomeLobbyBodyGate` matrix

| `activeBrowse` | `urlBrowse` | Catalogue body |
|----------------|-------------|----------------|
| `community` | `movies` / `tv` | `CommunityLobbySkeleton` |
| `movies` / `tv` | `community` | TMDb skeleton or dimmed stale grid |
| aligned | aligned | Current RSC branch |

### Community data tiers

| Tier | Endpoints | Blocks first Community paint |
|------|-----------|------------------------------|
| **Core** | `lists`, `reviews.recent`, `feed` or `feed.discover` | Yes (via Suspense child) |
| **Leaderboards** | `/api/leaderboard/films|tv` × 4 periods | No — client fill after mount |

Default feed **Lists** does not need leaderboards. **Film ranks / TV ranks** show skeleton until background fill completes; period chips stay client-only after fill (same as today).

### Prefetch

| Trigger | Action |
|---------|--------|
| `pointerenter` / `focusin` on Community tab | `router.prefetch(communityHref)` |
| `requestIdleCallback` on `/home` (Movies/TV) | Prefetch community href if user has not left lobby |

No leaderboard prefetch at idle.

## Component changes

| File / area | Change |
|-------------|--------|
| `home-sticky-chrome.tsx` | Use `selectBrowseSurface`; pill from `activeBrowse`; Community prefetch on hover |
| `home-browse-surface-context.tsx` | **New** — optimistic browse + href builders |
| `home-lobby-navigation-root.tsx` | **New** — shared `LobbyNavigationProvider` wrapper |
| `home-lobby-body-gate.tsx` | **New** — skeleton vs branch |
| `home-community-rsc-payload.tsx` | **New** — async RSC core fetch |
| `home/page.tsx` | Split community fetch; wrap community branch in Suspense |
| `home-community-lobby-params-context.tsx` | Accept empty leaderboards; merge background fetch into state |
| `home-tmdb-lobby-chrome.tsx` | Remove nested `LobbyNavigationProvider` (moved to root) |
| `home-community-patron-shell.tsx` | Remove nested `LobbyNavigationProvider` |

Reuse unchanged: `buildHomeLobbyHref`, `parseHomeBrowseSurface`, `readHomeLobbyPersisted`, `useLobbyTransition`, `lobby-grid-dim-pulse`, `fetchCommunityLeaderboard` (or existing client helper).

## Error handling

| Scenario | Behaviour |
|----------|-----------|
| Core Community RSC fails | Inline error + retry via `router.refresh()` |
| Leaderboard background fails | Ranks tabs: empty + retry; other feeds unaffected |
| Duplicate tap while pending | Ignore same target; last different target wins |
| Navigation abort | Clear `pendingBrowse`; sync pill to URL |
| Signed out | `feed.discover` unchanged |

## Testing

### Automated

- Unit: `selectBrowseSurface` hrefs (movies default, tv, community + persisted sort/period).
- Unit: core fetch module does not invoke leaderboard fetch in the same critical function.
- `bun run build` in `apps/web` — required gate.

### Manual QA

1. Movies → Community: pill &lt;100ms; skeleton → Lists without waiting for ranks.
2. Film ranks before leaderboard fill: skeleton → podium.
3. Movies ↔ TV: pill instant; grid dim pulse.
4. Community hover then tap: faster than cold tap.
5. Browser Back after browse change: consistent pill + body.
6. `/diary` → Community: cross-route push works.

## Rollout

| Wave | Deliverable | Exit criteria |
|------|-------------|---------------|
| **A** | Browse provider, body gate, navigation root, sticky chrome | QA 1, 3, 5 |
| **B** | Community core RSC + Suspense + deferred leaderboards + prefetch | QA 1, 2, 4, 6 |

## Relationship to Instant Lobby (2026-05-27)

| IL phase | Status | This spec |
|----------|--------|-----------|
| Phases 1–4 (diary, profile, watchlist, community chips, TMDb chips, detail tabs) | Shipped | Unchanged |
| Browse surface tabs | **Gap** | **This spec** |

Symptom **B** (frozen full page) on browse tabs is the same root cause documented in IL; browse navigation was never migrated to `navigate()` + optimistic state.

## Out of scope (v1)

- Removing `force-dynamic` on `(app)` routes
- App-wide React Query
- Single bundled leaderboard API
- Virtualizing Community activity/lists
- Eager prefetch of Community on every `/home` load
- Parallel route slots for browse surfaces
