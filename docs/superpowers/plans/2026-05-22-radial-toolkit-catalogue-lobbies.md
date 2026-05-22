# RadialToolkit — Catalogue Lobbies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add list-style radial context menus to catalogue poster lobbies (`/home` Movies/TV, `/diary`, `/watchlist`) via a shared `CataloguePosterTile` wrapper and testable item recipes.

**Architecture:** `CataloguePosterTile` owns `useRadialToolkitAnchor` + `RadialToolkit` around `MoviePoster`; `buildCatalogueRadialItems` returns menus per surface; `PopularMoviesInfinite` gains optional `renderPoster` for home/watchlist; diary grid swaps film/TV group posters to the tile.

**Tech Stack:** Next.js App Router, React 19 client components, `motion/react`, Zustand `useQuickLog`, existing Hono API client, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-radial-toolkit-catalogue-lobbies-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/catalogue-radial-items.ts` | Pure menu builders + types |
| `apps/web/src/lib/catalogue-radial-items.test.ts` | Recipe unit tests |
| `apps/web/src/components/catalogue/catalogue-poster-tile.tsx` | Wrapper + mutations |
| `apps/web/src/components/catalogue/use-add-to-list-from-radial.ts` | Headless list picker opener (optional extract) |
| `apps/web/src/components/movie/popular-movies-infinite.tsx` | `renderPoster` hook |
| `apps/web/src/components/home/*` | Pass `renderPoster` from home catalogue client boundary |
| `apps/web/src/components/diary/diary-lobby-grid.tsx` | Use tile for film rows |
| `apps/web/src/components/diary/diary-tv-group-cell.tsx` | Radial on group poster |
| `apps/web/src/components/watchlist/watchlist-lobby-catalogue.tsx` | Pass `renderPoster` |
| `AGENTS.md` | One bullet on catalogue radial scope |

---

### Task 1: Recipe builder (TDD)

**Files:**
- Create: `apps/web/src/lib/catalogue-radial-items.ts`
- Create: `apps/web/src/lib/catalogue-radial-items.test.ts`

- [ ] **Step 1: Write failing tests** for signed-out (2 items), home signed-in (5–6 items), diary with `logId` (includes Edit), watchlist (includes destructive Remove, no Add on TV).

- [ ] **Step 2: Run tests** — expect FAIL.

```bash
cd apps/web && bun test src/lib/catalogue-radial-items.test.ts
```

- [ ] **Step 3: Implement `buildCatalogueRadialItems`** with discriminated `surface` + callbacks stubbed in tests.

- [ ] **Step 4: Run tests** — expect PASS.

---

### Task 2: `CataloguePosterTile` shell

**Files:**
- Create: `apps/web/src/components/catalogue/catalogue-poster-tile.tsx`

- [ ] **Step 1: Copy elevation shell pattern** from `list-lobby-poster.tsx` (z-index, hover shadow, pointer handlers).

- [ ] **Step 2: Render `MoviePoster` inside shell** with props forwarded; toolkit portal when open.

- [ ] **Step 3: Wire actions** — copy link, `useQuickLog`, watchlist mutations (reuse `still-api-fetch` / detail user-state helpers), router refresh on success.

- [ ] **Step 4: Signed-out gate** — toast for gated actions per spec.

- [ ] **Step 5: Manual smoke** — one tile on a dev page or Storybook-less: import in isolation via temporary route **not required**; use `/lists` as visual reference.

---

### Task 3: Add-to-list from radial

**Files:**
- Modify: `apps/web/src/components/list/add-to-list-control.tsx` (extract) OR
- Create: `apps/web/src/components/catalogue/use-add-to-list-from-radial.ts`

- [ ] **Step 1: Extract list-load + picker open** so radial **Add to list** opens same picker UI.

- [ ] **Step 2: Movie-only guard** — no item when `listingKind === "tv"`.

- [ ] **Step 3: z-index** — picker above `z-[200]` toolkit.

---

### Task 4: `PopularMoviesInfinite` integration

**Files:**
- Modify: `apps/web/src/components/movie/popular-movies-infinite.tsx`
- Modify: home catalogue client component(s) that render `PopularMoviesInfinite`

- [ ] **Step 1: Add `renderPoster?: (seed, index) => ReactNode`** defaulting to current `renderLobbyMoviePoster`.

- [ ] **Step 2: Home Movies/TV** — pass `renderPoster` returning `CataloguePosterTile` with `surface="home"`.

- [ ] **Step 3: Verify** wave keys + `AnimatePresence` unchanged (wrapper inside `motion.div`).

---

### Task 5: Watchlist lobby

**Files:**
- Modify: `apps/web/src/components/watchlist/watchlist-lobby-catalogue.tsx`

- [ ] **Step 1: Pass `renderPoster`** with `surface="watchlist"`, `inWatchlist={true}` implicit.

- [ ] **Step 2: Remove action** — destructive variant, refresh grid on success.

---

### Task 6: Diary lobby

**Files:**
- Modify: `apps/web/src/components/diary/diary-lobby-grid.tsx`
- Modify: `apps/web/src/components/diary/diary-tv-group-cell.tsx`

- [ ] **Step 1: Film tiles** — `CataloguePosterTile` + `diaryRow`.

- [ ] **Step 2: TV group poster** — radial Edit uses latest log via `diaryLogToQuickLogOpenPayload` (match existing group edit).

- [ ] **Step 3: Confirm expand panel** still works (pointer down on grid outside collapse).

---

### Task 7: Verification & docs

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Run unit tests** — `catalogue-radial-items.test.ts`.

- [ ] **Step 2: Run build** — `cd apps/web && bun run build`.

- [ ] **Step 3: Manual QA** — matrix from spec (signed-in/out × 3 routes).

- [ ] **Step 4: `graphify update .`** from repo root.

- [ ] **Step 5: AGENTS.md** — catalogue lobbies use `CataloguePosterTile` + radial (scope A).

---

## Executor handoff

- Implement **one task at a time**; human **ok** between tasks per scratchpad workflow.
- Do **not** extend to detail pages or community rows without new spec.
