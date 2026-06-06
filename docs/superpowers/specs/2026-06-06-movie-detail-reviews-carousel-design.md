# Movie / TV detail — editorial reviews carousel

**Date:** 2026-06-06  
**Status:** Approved  
**Scope:** Community → Reviews on movie and TV detail pages only (not `/home` community).

## Goal

Replace the split **Spotlight reviews** grid + **All reviews** card stack with one unified horizontal carousel: large centered testimonial slides (quote → body → patron avatar + name), first slide centered in the viewport, swipe/scroll horizontally for more.

Reference: editorial testimonial layout — oversized centered quote typography, patron attribution below, minimal chrome, no film poster on slides (redundant on title detail).

## Behavior

- **Single carousel** for all public reviews on the title, ordered by likes then recency (unchanged API sort).
- **Remove** client-side featured split (`body.length >= 100`, top 2 spotlight).
- **Scroll:** native horizontal overflow with `scroll-snap-type: x mandatory` and `scroll-snap-align: center` per slide; hidden scrollbar; `data-lenis-prevent-wheel` on the rail.
- **Center-first:** inline padding on the flex row: `max(1.25rem, calc(50% - min(18rem, 44vw)))` so the first and last slides can center in the viewport.
- **Slide width:** `min(36rem, 88vw)`.
- **Tap slide:** opens existing review detail sheet (full body, comments, reactions).
- **Tap patron row:** navigates to profile (`stopPropagation` on author link).
- **Empty state:** unchanged copy when `reviews.length === 0`.
- **TV:** same component; reviews array remains empty until TV reviews ship (no API change for TV in this spec).

## Slide content

Center-aligned stack:

1. Quote mark (`"`) — decorative, muted.
2. Optional review **title** — semibold, smaller than body, when present.
3. Review **body** — primary type (`text-xl`–`text-2xl`), `text-balance`, clamp ~8 lines on slide; full text in detail sheet.
4. **Patron** — `PatronPortraitAvatar` + display name; `@handle` muted.
5. **Meta** — rating (if set), likes + replies count — small, tabular.

No borders, rings, or box-shadow on slides (`bg-card` section context, flat tiles per Sense overlay rules). No poster thumbnail on slides.

## Data

Extend `GET /api/movies/:id/reviews`:

- Join `profile` (`handle`, `displayName`) and `user` (`image` for avatar proxy).
- Return each row as review fields plus `author: { handle, displayName, image } | null`.

Extend `MoviePageReview` on web with optional `author`.

## Components / files

| File | Change |
|------|--------|
| `apps/server/src/routes/movies.ts` | Profile + user join on `/:id/reviews` |
| `apps/web/src/components/movie/movie-detail-reviews-carousel.tsx` | **New** — rail + slide |
| `apps/web/src/components/movie/movie-detail-explore-tabs.tsx` | Replace `reviewsPanel` grids; drop featured props |
| `apps/web/src/components/movie/movie-detail-about-async.tsx` | Map author; remove featured split |
| `apps/web/src/components/tv/tv-detail-community-async.tsx` | Drop featured props |

## Out of scope

- `/home` community reviews tab
- TV review API
- Infinite pagination beyond existing 20-review limit
- Arrow buttons / dot indicators (may add later)

## Success criteria

- Movie detail Community → Reviews shows one horizontal carousel with centered first slide.
- Slides match editorial testimonial hierarchy (quote, body, patron).
- Author name/avatar visible when profile exists.
- Tap opens review reader; profile link works independently.
- TV detail renders empty state without regression.
