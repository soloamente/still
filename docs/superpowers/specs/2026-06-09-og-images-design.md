# OG share images — design

**Date:** 2026-06-09  
**Status:** Approved

## Goal

Minimal Open Graph previews when sharing Sense URLs: film art where it matters, Sense wordmark only on composites, global branded fallback everywhere else.

## Share matrix

| URL | `og:image` |
|-----|------------|
| `/`, `/home` | `/og/home` — TMDb popular #1 backdrop + Sense wordmark |
| `/movies/[id]`, `/tv/[id]` | `/og/title/movie\|tv/[id]` — backdrop/still + small Sense mark |
| All other routes | `/og/default` — Sense-only card (root layout) |

Page-specific OG (profile taste, list covers) is **out of scope** for v1.

## Visual language

- Canvas: 1200×630, dark base `#09090a`
- **Home / landing:** full-bleed popular backdrop, bottom gradient scrim, centered Sense wordmark — no tagline or film title on image
- **Title:** full-bleed backdrop (poster fallback), small Sense mark bottom-right — no title overlay
- **Default / fallbacks:** flat dark background + Sense wordmark only

## Architecture

Centralized `/og/*` routes (same pattern as `/og/taste/[handle]`) + `openGraph.images` / `twitter.images` in metadata.

- `apps/web/src/lib/og/` — Satori layout helpers, backdrop fetchers, metadata URL helpers
- `app/og/default/route.tsx` — static Sense card
- `app/og/home/route.tsx` — popular #1 + Sense; falls back to default layout
- `app/og/title/movie/[id]/route.tsx` · `app/og/title/tv/[id]/route.tsx` — listing art + corner mark

## Data & fallbacks

- Home: `GET /api/movies/popular` → first `backdrop_url`; API miss → default card
- Title: movie/TV detail `backdrop_url`, else `poster_url`; none → default card

## Caching

- `/og/home`: `revalidate` ~1 hour
- Title routes: ~24 hours
- `/og/default`: long cache / static

## Metadata wiring

- `app/layout.tsx` → `/og/default`
- `app/page.tsx`, `app/(app)/home/page.tsx` → `/og/home`
- `movies/[id]`, `tv/[id]` `generateMetadata` → title-specific OG URL

## Follow-up

- Wire `/og/taste/[handle]` into profile metadata
- Public list cover OG on `/l/[id]`
