# Instant Lobby Navigation — Implementation Plan

> **For agentic workers:** Implement **one task at a time**. After each task, run verification steps, update `.cursor/scratchpad.md` Project Status Board, and ask the human for **`ok`** before the next task (Executor workflow).

**Goal:** Eliminate full-page freeze on in-page filter chips (venue, tab, order) by hoisting patron-owned datasets into client shells and navigating with `useTransition` + `router.replace({ scroll: false })`.

**Architecture:** Shared `useLobbyTransition` + optional `LobbyNavigationProvider`; thin RSC pages fetch once; `*PatronLobbyShell` components derive grids via existing pure helpers in `useMemo`; chip components stop using `<Link>` for same-pathname query changes.

**Tech Stack:** Next.js 16 App Router, React 19 `useTransition`, `motion/react`, existing `*-lobby-order.ts` parsers.

**Spec:** `docs/superpowers/specs/2026-05-27-instant-lobby-navigation-design.md`

---

## File map (Phase 1)

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/use-lobby-transition.ts` | `useLobbyTransition()` hook |
| `apps/web/src/components/lobby/lobby-navigation-provider.tsx` | Context: `{ navigate, isPending }` for chip children |
| `apps/web/src/components/diary/diary-patron-lobby-shell.tsx` | Client shell: derive grid, empty states, chip row |
| `apps/web/src/app/(app)/diary/page.tsx` | Thin RSC: fetch logs + prefs → shell |
| `apps/web/src/components/diary/diary-catalog-order-chips.tsx` | `navigate(buildDiaryLobbyHref)` instead of `<Link>` |
| `apps/web/src/components/diary/diary-venue-chips.tsx` | Extract diary venue pills from `HomeCatalogViewModeToolbar` |
| `apps/web/src/components/profile/profile-patron-lobby-shell.tsx` | Client shell: tab/venue/order derive + panels |
| `apps/web/src/app/(app)/profile/[handle]/page.tsx` | Thin RSC: fetch profile → shell props |
| `apps/web/src/components/profile/profile-tab-toolbar.tsx` | `navigate` for tab chips |
| `apps/web/src/components/profile/profile-catalog-order-chips.tsx` | `navigate` for order |
| `apps/web/src/components/profile/profile-catalog-venue-chips.tsx` | `navigate` for venue |
| `apps/web/src/components/watchlist/watchlist-patron-lobby-shell.tsx` | Client shell for order + grid |
| `apps/web/src/app/(app)/watchlist/page.tsx` | Thin RSC |
| `apps/web/src/components/watchlist/watchlist-catalog-order-chips.tsx` | `navigate` for order |

**Phase 3+ (later plans):** `lobby-grid-pending-overlay.tsx`, `home-catalog-view-mode-toolbar.tsx`, `home-catalog-sort-chips.tsx`, detail route Suspense splits.

---

## Phase 1 — Patron-owned lobbies

### Task 1: `useLobbyTransition` + provider

**Files:**
- Create: `apps/web/src/lib/use-lobby-transition.ts`
- Create: `apps/web/src/components/lobby/lobby-navigation-provider.tsx`

- [ ] **Step 1: Implement hook**

```ts
// use-lobby-transition.ts — pattern
export function useLobbyTransition() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = useCallback((href: string) => {
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }, [router]);
  return { isPending, navigate };
}
```

- [ ] **Step 2: Provider** wraps children; exposes `navigate` / `isPending`. Export `useLobbyNavigation()` that throws outside provider (dev-friendly).

- [ ] **Step 3: Verify** `cd apps/web && bun run build` — no type errors.

**Success:** Hook importable; provider composes without runtime errors.

---

### Task 2: Diary patron lobby shell

**Files:**
- Create: `apps/web/src/components/diary/diary-patron-lobby-shell.tsx`
- Modify: `apps/web/src/app/(app)/diary/page.tsx`
- Create: `apps/web/src/components/diary/diary-venue-chips.tsx` (copy diary branch UI from `home-catalog-view-mode-toolbar.tsx`)

- [ ] **Step 1: Move derive logic from `diary/page.tsx` into shell**

Shell props (serializable):

```ts
interface DiaryPatronLobbyShellProps {
  rawRows: DiaryLogRow[]; // full listing rows from RSC
  monochromePeersOnHover: boolean;
  signedIn: boolean;
  initialOrder: DiaryLobbyOrder;
  initialVenue: HomeVenue;
}
```

Inside shell:

1. `useSearchParams()` for live URL (back/forward).
2. `parseDiaryLobbyOrder` / `parseDiaryLobbyVenue` from params.
3. `useMemo` pipeline: `filter(isDiaryLogWithListing)` → `diaryLogMatchesDiaryLobbyVenue` → `sortDiaryLobbyRowsForOrder` → `buildDiaryLobbyGridItems`.
4. `waveKey`: use `${order}::${venue}::${keys}` but consider **`order`-only** wave remount if venue-only filter should not re-animate every poster (spec optional polish).

- [ ] **Step 2: Shell layout**

- Wrap chip row + grid in `LobbyNavigationProvider`.
- Render `DiaryCatalogOrderChips` + `DiaryVenueChips` + empty state + `DiaryLobbyCatalogue` (unchanged child).

- [ ] **Step 3: Thin RSC page**

- Keep: `HomeStickyChrome`, `CatalogWatchRegionPrompt`, auth, `fetchMyLogsMeServer`, prefs.
- Remove: server-side filter/sort/grid/empty branch — pass `raw` to shell with `initialOrder` / `initialVenue` from `searchParams`.

- [ ] **Step 4: Build** `cd apps/web && bun run build`

**Success:** `/diary` renders same grid on first load; shell mounts without hydration mismatch (initial* matches URL).

---

### Task 3: Diary chips — `navigate` not `Link`

**Files:**
- Modify: `apps/web/src/components/diary/diary-catalog-order-chips.tsx`
- Modify: `apps/web/src/components/diary/diary-venue-chips.tsx`

- [ ] **Step 1: `DiaryCatalogOrderChips`**

- `useLobbyNavigation()` → on chip press: `navigate(buildDiaryLobbyHref({ order, venue }))`.
- Use `<button type="button">` styled like current `Link` (keep `motion` active pill).
- `aria-current="page"` when active.

- [ ] **Step 2: `DiaryVenueChips`**

- Same pattern for theaters / streaming.
- Include filters icon `Link` to `/home` or discover (unchanged behaviour from toolbar).

- [ ] **Step 3: Remove diary venue `<Link>`s from `HomeCatalogViewModeToolbar`**

- Diary page no longer renders `HomeCatalogViewModeToolbar` in chip row (shell owns venue).

- [ ] **Step 4: Manual QA — diary**

| Action | Expected |
|--------|----------|
| Tap In cinemas ↔ At home | Chip + grid update immediately; no full-page freeze |
| Tap order chips | Same |
| Hard refresh `?venue=theaters` | Correct slice |
| Browser Back | Grid matches URL |

- [ ] **Step 5: Build**

**Human gate:** reply **`ok`** on diary before profile work.

---

### Task 4: Profile patron lobby shell

**Files:**
- Create: `apps/web/src/components/profile/profile-patron-lobby-shell.tsx`
- Modify: `apps/web/src/app/(app)/profile/[handle]/page.tsx`
- Modify: `apps/web/src/components/profile/profile-lobby-chrome.tsx` (optional: accept `isPending` for subtle grid dim)

- [ ] **Step 1: Extract pure helpers still on page**

Move or import unchanged: `filmographyFromRecentlyWatched`, `resolveProfileTab`, `splitFilmographyLedger`, `titleCountLineForTab`, favorites redirect handling.

**Redirect note:** `?tab=favorites` legacy redirect may stay in RSC `page.tsx` before shell render (server `redirect()` is fine).

- [ ] **Step 2: Shell props**

```ts
interface ProfilePatronLobbyShellProps {
  handle: string;
  isMe: boolean;
  profile: { displayName, bio, ... }; // minimal header fields
  user: { image };
  stats: { followers, following };
  recentlyWatched: ProfileFilmographyRow[];
  recentReviews: ...;
  lists: ...;
  earnedBadges: ...;
  unlockedAchievements: ...;
  socialTabs: ProfileSocialTabId[];
  monochromePeersOnHover: boolean;
  initialTab, initialOrder, initialVenue, initialFavoritesOnly;
}
```

- [ ] **Step 3: Shell owns**

- `ProfileTopBar`, `ProfilePatronHeader`, `ProfilePatronMilestones` can stay in RSC **above** shell OR move into shell (prefer RSC header for SEO — keep header in RSC, shell starts at `ProfileLobbyChrome`).

- Derive: `contentTab`, `toolbarActiveTab`, `ledgerTab`, filtered `movieRows` / `tvRows`, `catalogueWaveKey`, empty states, `ProfileTabPanels`.

- [ ] **Step 4: Thin RSC**

- Fetch profile + badges + achievements once.
- Pass props; no filter/sort in RSC.

- [ ] **Step 5: Build**

---

### Task 5: Profile chips — `navigate` not `Link`

**Files:**
- Modify: `profile-tab-toolbar.tsx`, `profile-catalog-order-chips.tsx`, `profile-catalog-venue-chips.tsx`

- [ ] **Step 1:** Each chip row uses `useLobbyNavigation()` + `buildProfileLobbyHref(...)`.

- [ ] **Step 2:** Tab toolbar `profileTabHref` → `navigate(href)` on click.

- [ ] **Step 3: Manual QA — profile**

| Action | Expected |
|--------|----------|
| Movies ↔ TV | Instant |
| Venue toggle on ledger | Instant |
| Favorites chip | Instant |
| Lists / Reviews tabs | Instant (data already hoisted) |
| Shared URL `?tab=tv&venue=theaters` | Correct first paint |

- [ ] **Step 4: Build**

**Human gate:** reply **`ok`** on profile before watchlist.

---

### Task 6: Watchlist patron lobby shell

**Files:**
- Create: `apps/web/src/components/watchlist/watchlist-patron-lobby-shell.tsx`
- Modify: `apps/web/src/app/(app)/watchlist/page.tsx`
- Modify: `watchlist-catalog-order-chips.tsx`

- [ ] **Step 1: Shell** — hoist `sortWatchlistLobbyRowsForOrder`, seeds, `posterCellKeys`, empty state (watchlist has **order only**, no venue).

- [ ] **Step 2: Order chips** — `navigate` with `buildWatchlistLobbyHref` (add helper in `watchlist-lobby-order.ts` if missing).

- [ ] **Step 3: Keep** `HomeCatalogViewModeToolbar` filters-only link on watchlist (no venue rail).

- [ ] **Step 4: Manual QA + build**

**Human gate:** reply **`ok`** for Phase 1 complete.

---

### Task 7: Phase 1 closure

- [ ] `bun run build` in `apps/web`
- [ ] Update `AGENTS.md` one line: patron lobbies use instant client filter navigation
- [ ] Scratchpad: mark IL.2 / IL.3 Phase 1 tasks done

---

## Phase 2 — Community & order polish (outline)

| Task | Work |
|------|------|
| 2.1 | `/home?browse=community` — hoist feed payload; `HomeCommunityPeriodToolbar` → `useLobbyTransition` |
| 2.2 | After quick-log PATCH on diary — `router.refresh()` only on mutation success |
| 2.3 | Optional: split diary `waveKey` so venue-only changes skip full poster remount |

**Gate:** `bun run build` + manual community period toggle.

---

## Phase 3 — `/home` TMDb lobbies (outline)

| Task | Work |
|------|------|
| 3.1 | Create `LobbyGridPendingOverlay` |
| 3.2 | `useLobbyTransition` on `HomeCatalogSortChips` + `HomeCatalogViewModeToolbar` (movies/TV) |
| 3.3 | Suspense-wrap `PopularMoviesInfinite`; keep stale grid at `opacity-60` while `isPending` |
| 3.4 | `router.prefetch` on chip `pointerenter` for next href |

**Gate:** Chips instant; grid shows overlay not frozen chrome.

---

## Phase 4 — Detail routes (outline)

| Task | Work |
|------|------|
| 4.1 | Movie detail — Suspense split About / Streaming tabs |
| 4.2 | TV detail — same |
| 4.3 | List detail — section nav query tabs |

---

## Manual test matrix (Phase 1)

| Route | Chips to exercise |
|-------|-------------------|
| `/diary` | order × venue |
| `/profile/@handle` | tab × order × venue × favorites |
| `/watchlist` | order |

**Fail criteria:** Any tap where sticky search + chips freeze until network completes.

---

## Rollback

Phase 1 is isolated per route — revert shell + restore RSC filter in `page.tsx` if needed. No DB or API changes.
