# Home sticky search — responsive centering

**Status:** Approved — implemented 2026-05-22  
**Date:** 2026-05-22  
**Scope:** `/home` lobby header (`HomeStickyChrome`, `HomeStickySearch`) and global catalog search sheet (`CatalogSearchDialogRoot`)

## Assumptions (correct me before implementation)

1. **Target surfaces:** `/home`, `/diary`, `/watchlist`, `/lists` — all reuse `HomeStickyChrome` + the same sticky pill.
2. **“Centered” means** horizontally centered in the **visible main column** (`#main-content` width, including `px-2.5` gutters), not the full physical viewport ignoring app padding.
3. **Open dialog** should stay aligned with the pill when possible; on resize, the sheet **recomputes** position (no frozen `left` from open time).
4. **No IA change** — browse tabs stay left, shortcuts stay right; only layout/positioning/overlap fixes.
5. **Motion:** resize-driven layout updates are **instant** (no spring re-animation); open/close animation unchanged.
6. **Breakpoints:** keep `sm` as the threshold where the header becomes a three-track bar; improve behavior **between** `sm` and ~`xl` where overlap is reported.

---

## Objective

Fix Agentation feedback on `/home` (~1659×1197 and when resizing): the sticky search pill **overlaps** the left browse rail, does not read as **viewport-centered**, and the **catalog search dialog** drifts off-center when the window width changes because panel geometry is computed once at open.

**User story:** As a patron resizing the browser or using a mid-width laptop, I see the search pill centered in the header without colliding with Movies/TV/Community, and if the search sheet is open, it stays centered on the pill (or the main column) as I resize.

---

## Root cause (from current code)

| Issue | Cause |
|--------|--------|
| Pill not visually centered | `HomeStickyChrome` uses `sm:grid-cols-[1fr_minmax(20rem,56rem)_1fr]`. The pill is centered only inside the **middle grid track**, while left/right tracks have **unequal content width** (wide browse rail vs compact icon cluster). `header` also sets `overflow-visible`, so the left rail can paint over the middle track. |
| Overlap on resize | Left column is `flex-wrap` without a hard max width or clip; when `1fr` shrinks, intrinsic min-width of three browse chips can exceed the cell and overflow into the search track. |
| Dialog off-center on resize | `panelLayout` in `CatalogSearchDialogRoot` is set once in `openDialogFromRect` via `computeCatalogSearchAnchoredPanelStyle`. There is **no** `resize` / `ResizeObserver` handler to update `left`, `width`, or `maxHeight`. |

Relevant modules:

- `apps/web/src/components/home/home-sticky-chrome.tsx` — header grid
- `apps/web/src/components/home/home-sticky-search.tsx` — pill + dialog panel (`fixed` + motion `left`/`width`)
- `apps/web/src/lib/catalog-search-dialog-store.ts` — `clampCatalogSearchPanelLeftFromCenter`, `computeCatalogSearchAnchoredPanelStyle`

---

## Tech stack

- Next.js App Router (`apps/web`), React 19, Tailwind v4, Motion (`motion/react` in search; `framer-motion` in chrome — pre-existing split)
- Zustand store for dialog open state
- No new dependencies expected

---

## Commands

```bash
# Dev (web)
bun run dev:web

# Typecheck web app
bun run check-types --filter=web
# or from apps/web:
cd apps/web && bun run build

# Lint/format (repo root)
bun run check
```

Manual verification: `/home` at widths **360, 640, 768, 1024, 1280, 1440, 1659** px; open search; drag window width with sheet open and closed.

---

## Project structure

```
apps/web/src/components/home/
  home-sticky-chrome.tsx    # header layout — primary grid/positioning change
  home-sticky-search.tsx    # pill + CatalogSearchDialogRoot — resize sync
apps/web/src/lib/
  catalog-search-dialog-store.ts   # layout math + optional shared helper
apps/web/src/lib/__tests__/        # new unit tests for clamp/resize math (if added)
docs/superpowers/specs/
  2026-05-22-home-sticky-search-responsive-design.md  # this file
```

---

## Proposed approach

### A. Header — true main-column centering (recommended)

Use a **single-row grid** with the search in a **full-width overlay track** centered with `justify-self-center`, while browse + shortcuts remain in side tracks:

- Grid template (conceptual): `[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)]` or named areas with search spanning the center via `grid-column: 1 / -1` + `justify-self-center` on a wrapper with `pointer-events-none`, pill `pointer-events-auto`.
- Side columns: `min-w-0`, `overflow-hidden` (or clip) so browse chips **truncate/wrap inside** their track instead of overlapping the pill.
- Pill width: cap with `w-full max-w-[36rem]` (existing ~36rem intent) inside the centered wrapper.

**Alternative (simpler, slightly less robust):** keep current 3-column grid but add `isolate` + higher `z-index` on search and `overflow-hidden` on left column only. Does not fix optical off-center; **not preferred**.

### B. Dialog — live layout on resize

While `showSheet && panelLayout`:

1. Subscribe to `window` `resize` (passive) or `ResizeObserver` on `document.documentElement`.
2. Re-read anchor: `homeTriggerEl?.getBoundingClientRect()` (fallback: stored `anchorCenterX` / `defaultCatalogSearchShortcutAnchorRect`).
3. Recompute with `computeCatalogSearchAnchoredPanelStyle` and merge into `panelLayout` (preserve anchor fields used for exit animation).
4. Debounce ~50–100ms optional; prefer `requestAnimationFrame` coalescing.

Optional enhancement: export `recomputeCatalogSearchPanelLayout(anchor: DOMRect, prev?: PanelLayout)` from the store module for unit tests.

### C. Pill width vs narrow center track

Below ~640px the header already stacks (`grid-cols-1`); ensure search row is **first or second** in stack order (current order: browse → search → shortcuts — acceptable if search is full width). At `sm+`, enforce `max-w-full` on pill so it never exceeds the centered slot.

---

## Code style

- Keep layout constants in `catalog-search-dialog-store.ts` (gutter, min/max width).
- Prefer CSS grid/flex over JS measurement for **closed** header state.
- Use `useEffect` + cleanup for resize listeners; no inline imports.

Example (resize sync sketch — not final API):

```ts
useEffect(() => {
  if (!showSheet || !homeTriggerEl) return;
  const update = () => {
    const rect = homeTriggerEl.getBoundingClientRect();
    setPanelLayout((prev) =>
      prev ? { ...prev, ...computeCatalogSearchAnchoredPanelStyle(rect), anchorCenterX: rect.left + rect.width / 2 } : null,
    );
  };
  window.addEventListener("resize", update, { passive: true });
  return () => window.removeEventListener("resize", update);
}, [showSheet, homeTriggerEl]);
```

---

## Testing strategy

| Level | What |
|--------|------|
| **Unit** | `clampCatalogSearchPanelLeftFromCenter` and `computeCatalogSearchAnchoredPanelStyle` with mocked `window.innerWidth` / DOMRect fixtures (jsdom or vitest if present; else bun test file colocated with store). Cases: narrow viewport, wide viewport, center clamped at gutters. |
| **Manual** | Matrix above; overlap check with browse rail; dialog open + continuous resize; ⌘K open without pill (fallback anchor still centered). |
| **Regression** | Open/close animation still runs; `prefers-reduced-motion` unchanged; focus return to pill on close. |

No Playwright requirement for v1 unless you ask for it.

---

## Boundaries

- **Always:** Preserve existing search UX (tokens, ⌘K, anchored grow animation on open/close); run `check-types` for `web` before calling done.
- **Ask first:** Changing `sm` breakpoint for header stack; switching header to absolute-centered pill if it affects other routes’ sticky filters.
- **Never:** Reintroduce `/search` route; add borders/rings to the pill for “fixing” overlap; disable open animation entirely.

---

## Success criteria

1. At **1024–1659px** width on `/home`, the search pill does **not** overlap Movies/TV/Community chips (no horizontal collision at rest).
2. At the same widths, the pill’s horizontal center is within **8px** of the center of `#main-content`’s client box (measure in DevTools).
3. With the catalog sheet **open**, resizing the window width by ±400px keeps the panel’s horizontal center within **8px** of the pill’s center (or recomputed anchor center).
4. At **360px** width, header stacks cleanly: pill is full-width (minus gutters), tappable, no horizontal scroll on the header row.
5. `bun run check-types --filter=web` passes (or `apps/web` build passes).

---

## Open questions

1. **Centering reference:** Confirm main-column center (`#main-content`) vs full viewport — spec assumes **main column**.
2. **Narrow three-column:** If overlap persists between 640–900px, should we **stack the search to its own row** at `md` instead of `sm`?
3. **Executor mode:** Proceed implementation in one PR after you approve this spec, or split header fix vs dialog resize?

---

## Implementation plan (post-approval)

1. Adjust `home-sticky-chrome.tsx` grid + overflow + centered search wrapper (closed state).
2. Add resize listener + layout recompute in `CatalogSearchDialogRoot` (open state).
3. Unit tests for layout math in `catalog-search-dialog-store.ts`.
4. Manual matrix + update `AGENTS.md` / scratchpad lesson if a new breakpoint rule is added.

---

## Task breakdown (Executor — one task at a time)

- [ ] **Task 1 — Header layout**  
  - **Acceptance:** Success criteria 1, 2, 4 at rest (sheet closed).  
  - **Verify:** Manual width matrix; no overlap screenshot at 1280px.  
  - **Files:** `home-sticky-chrome.tsx`, possibly `home-sticky-search.tsx` (classNames only).

- [ ] **Task 2 — Dialog resize sync**  
  - **Acceptance:** Success criterion 3.  
  - **Verify:** Open sheet, drag window width, panel tracks pill.  
  - **Files:** `home-sticky-search.tsx`, `catalog-search-dialog-store.ts`.

- [ ] **Task 3 — Unit tests + typecheck**  
  - **Acceptance:** Clamp math covered; criterion 5.  
  - **Verify:** `bun run check-types --filter=web` (or web build).  
  - **Files:** new `catalog-search-dialog-store.test.ts` (or project test convention).
