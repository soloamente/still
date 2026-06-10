# Movie detail editorial rail controls — footer row design

**Date:** 2026-06-10  
**Status:** Approved  
**Related:** Movie/TV detail About tab — Backgrounds stills rail, Community reviews rail

## Problem

On movie detail at `xl+` viewports, overlay prev/next chevrons on editorial carousels sit in the right gutter where the fixed **On this page** section legend (`MovieDetailSectionNav`, `z-40`) is positioned. The right arrow uses `z-20`, so the legend intercepts clicks — reported on `/movies/1380291` Backgrounds rail.

Root cause: carousels break out into the nav gutter (`xl:-mx-28`) while arrows are absolutely positioned near the right edge (`xl:right-8`).

## Goal

Make prev/next always clickable without fighting the section legend, while keeping Pasito dot navigation and drag-scroll behavior.

## Decision (brainstorming)

| Question | Decision |
| --- | --- |
| Scope | Shared editorial rails — **Backgrounds + Community reviews** (both use `DetailEditorialRailArrowButtons` + `DetailEditorialRailPasito`) |
| Approach | **Unified footer row** — `[ ← ] Pasito pills [ → ]` below the rail; remove edge overlays entirely (option 1) |
| Hero backdrop Pasito | Unchanged (separate hero stepper, no section nav conflict) |
| Section nav changes | Out of scope |

## 1. Layout

**Before:** Overlay chevrons mid-rail (absolute `left/right`) + centered Pasito row below.

**After:** Single centered footer row below the rail:

```
[ Prev ]   ● ● ● ●   [ Next ]
     ↑ Pasito stepper ↑
```

- Container: `flex items-center justify-center gap-3 mt-4` (preserve current pasito top spacing).
- Prev / Next: same visual tokens as today (`size-11`, round, `bg-background/90`, disabled at start/end).
- Pasito: existing `DetailArtworkPasitoStepper` behavior unchanged.
- Hide entire footer when `totalSlides <= 1` (same gate as today).

**Remove** `DetailEditorialRailArrowButtons` from inside carousel `<section>` elements in:

- `movie-detail-stills-carousel.tsx`
- `movie-detail-reviews-carousel.tsx`

## 2. Component changes

| File | Change |
| --- | --- |
| `detail-editorial-rail-controls.tsx` | Replace split exports with **`DetailEditorialRailFooterControls`** combining prev, pasito, next; keep shared button class; remove absolute positioning from nav buttons |
| `movie-detail-stills-carousel.tsx` | Swap pasito-only footer for unified footer; drop overlay arrows |
| `movie-detail-reviews-carousel.tsx` | Same |

Optional cleanup: delete or internalize `DetailEditorialRailArrowButtons` if no other callers remain.

**Props** (footer component):

- `totalSlides`, `activeSlideIndex`, `onPrev`, `onNext`, `onGoto`, `ariaLabel` (pasito tablist)

## 3. Interaction & accessibility

- Prev/next `aria-label` unchanged (`Previous slide` / `Next slide`).
- Pasito row keeps `role="tablist"` + per-step behavior from Pasito.
- Drag scroll, slide click-to-focus, wheel: unchanged (`useDetailEditorialRailSnap`).
- Disabled prev at index 0, disabled next at last index — unchanged.

## 4. Visual notes

- Footer row sits in the content column center — **never** under the fixed right legend.
- Chevrons move from mid-rail to below frame; acceptable trade for reliable taps.
- Same breakpoint behavior at all widths (no mobile overlay / desktop footer split).

## 5. Testing

**Manual**

1. `/movies/1380291` — About → Backgrounds: prev/next clickable at 1472×1304 with section nav visible.
2. Scroll to Community reviews rail — same footer row, no legend overlap.
3. TV detail About — parity if stills/reviews rails present.
4. Single-slide / empty rails — footer hidden.
5. Reduced motion — pasito transitions unchanged.

**Regression**

- No new unit tests required (presentational layout); optional snapshot/story if project adds later.

## 6. Success criteria

- Right (and left) carousel arrows always receive clicks on `xl+` with section nav visible.
- One shared footer control row on Backgrounds and Community editorial rails.
- No z-index fight with `MovieDetailSectionNav`.
- Pasito dots and drag-scroll still work.

## 7. Out of scope

- Repositioning section nav legend.
- Hero artwork pasito / backdrop stepper.
- List detail (does not use editorial rail carousels today).
