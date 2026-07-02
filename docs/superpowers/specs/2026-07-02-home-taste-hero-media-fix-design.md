# Home Taste Hero Media Fix — Design

**Date:** 2026-07-02  
**Status:** Approved

## Problem

On `/home` Movies, the taste-matched hero (`HomeTasteMatchedHero`) has three issues:

1. **Production:** Title logos fall back to plain text; trailers never play (static backdrop only).
2. **All environments:** A dark empty strip appears on the **right** of the hero media at every viewport (mobile, mid, 2K).
3. **Hydration:** Console errors from SSR/client mismatch — notifications bell unread state; taste hero YouTube `origin` param built with `window` on client only.

## Root causes

| Issue | Cause |
|-------|--------|
| Logo missing in prod | Cached `tmdbJson.images` from `append_to_response` stores **backdrops/posters only** — logos require `tmdbApi.movieImages()`. Catalogue-sync rows have no `tmdbJson`. Enrichment + client fallback need **`TMDB_API_KEY` on the API server** (optional in env — missing in production). |
| Trailer missing in prod | Same: needs `tmdbJson.videos` or live `/videos` fetch via API key. |
| Right-side gap | Media shell uses `absolute -left-4 -right-4` without guaranteed full-bleed width; trailer iframe uses `aspect-video min-h-full min-w-full` which fails to **cover** wide hero bands. |
| Hydration | `typeof window !== 'undefined' ? window.location.origin` in trailer URL; inbox unread count updates client-side before hydrate. |

## Solution

### A — Media shell full bleed

Replace asymmetric negative inset with centered explicit width: `left-1/2 -translate-x-1/2 w-[calc(100%+2rem)]` so media always spans the catalogue card edge (cancels parent `p-4`).

### B — Trailer iframe object-cover

Use **container query** units on the media inner shell (`@container`) so iframe dimensions are `max(100cqw, 100cqh×16/9)` × `max(100cqh, 100cqw×9/16)` — true cover at any aspect ratio.

### C — Stable trailer origin

Build YouTube embed URL with `env.NEXT_PUBLIC_SERVER_URL` (same on server and client) — never `window.location.origin` during render.

### D — Notifications bell hydration

Gate unread icon/dot/`aria-label` behind `useEffect` mount so SSR and first client paint match (neutral bell); live unread appears after hydrate.

### E — Production deploy note

Verify **`TMDB_API_KEY`** is set on the **Elysia API** Vercel project (`API_REWRITE_ORIGIN` target). Web rewrites `/api/*` but TMDb calls run server-side.

## Files

- `apps/web/src/lib/home-taste-hero-layout.ts` — shell bleed class
- `apps/web/src/components/home/home-taste-hero-media-layer.tsx` — container + iframe cover
- `apps/web/src/components/home/home-taste-matched-hero.tsx` — stable origin
- `apps/web/src/components/notifications/notifications-bell-menu.tsx` — hydration gate
- `apps/web/src/lib/home-taste-hero-trailer-src.test.ts` — origin param test (new)

## Success criteria

- Hero backdrop/trailer fills card edge-to-edge on mobile, tablet, desktop, 2K (no right gap).
- Localhost: logo + trailer unchanged (still work).
- Production: logo + trailer work when `TMDB_API_KEY` is set on API server.
- No hydration mismatch on `/home` for notifications bell or taste hero iframe `src`.
- Existing taste hero / enrichment tests pass.

## Out of scope

- Prefetching logos into catalogue sync rows.
- Notifications unread SSR prefetch from RSC (future optimization).
