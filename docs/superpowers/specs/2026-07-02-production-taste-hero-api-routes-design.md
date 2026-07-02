# Production Taste Hero API Routes — Design

**Date:** 2026-07-02  
**Status:** Approved

## Problem

On production (`cinema.sense.fans`), the home taste hero does not show TMDb title logos or background trailers. Browser requests:

- `GET /api/movies/{id}/title-logo`
- `GET /api/movies/{id}/trailer`

return **HTTP 200** with body `{"error":"NOT_FOUND","code":"NOT_FOUND"}`. Local dev works.

HAR capture (`cinema.sense.fans.har`, 2026-07-02) confirms:

- Requests hit the web origin (`cinema.sense.fans`); Next rewrites reach the Elysia API (CORS headers present).
- Other API routes on the same session work (`/api/logs/me/by-movie/76`, `/api/auth/get-session`, `/api/realtime/presence`, etc.).
- `GET /api/community/month-recap` also returns the same `NOT_FOUND` body — the production API build is missing **multiple newer routes**, not only taste-hero media.

The client treats `response.ok === true` as success and silently ignores the error body (no `logoPath` / `trailerKey`).

## Root cause

The **Elysia API deployment** behind `API_REWRITE_ORIGIN` is **stale** relative to `main`. Routes exist in repo (`apps/server/src/routes/movies.ts` lines ~752–767) but are not registered on the live API.

This is **not**:

- A missing `TMDB_API_KEY` alone (that would return `{ logoPath: null }` from the real handlers).
- A broken Next rewrite (other `/api/*` paths succeed).
- A web-only deploy gap (redeploying web without API does not add routes).

Secondary issue: Elysia `onError` in `apps/server/src/server/app.ts` returns JSON for `NOT_FOUND` without setting HTTP 404, so clients cannot distinguish route-missing from empty media.

## Solution (Approach A — deploy + verify)

### 1. Redeploy the API project

Redeploy **`apps/server`** (the Vercel project targeted by `API_REWRITE_ORIGIN` on the web project — e.g. `cue-server-*.vercel.app` or future `api.sense.fans` Worker).

Ensure the deployment includes commits with:

- `GET /api/movies/:id/title-logo`
- `GET /api/movies/:id/trailer`
- `resolveMovieTitleLogoPath` / `resolveMovieTrailer` libs
- `enrichTasteMatchMovies` in `/api/taste/for-you` (server-side enrichment path)

No application code change required for the primary fix if `main` already contains these routes.

### 2. Verify environment on the API project

| Variable | Required | Notes |
|----------|----------|-------|
| `TMDB_API_KEY` | Yes (for logos/trailers when cache lacks them) | Set on **API** project, not web |
| `DATABASE_URL` | Yes | Unchanged |
| `BETTER_AUTH_URL` | Yes | Must match **web** URL (`https://cinema.sense.fans`) |
| `CORS_ORIGIN` | Yes | Must match **web** URL |

Web project must keep:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SERVER_URL` | `https://cinema.sense.fans` |
| `API_REWRITE_ORIGIN` | Live API host URL (not the web URL) |

Redeploy **web** only if `API_REWRITE_ORIGIN` changed.

### 3. Production smoke tests

Run after API redeploy (replace `76` with any known TMDb id):

```bash
# Must NOT return NOT_FOUND
curl -sS "https://cinema.sense.fans/api/movies/76/title-logo"
curl -sS "https://cinema.sense.fans/api/movies/76/trailer"

# Expected shapes (null values OK when TMDb has no asset):
# {"logoPath":"/abc.png"} or {"logoPath":null}
# {"trailerKey":"…","trailerSite":"YouTube"} or {"trailerKey":null,"trailerSite":null}
```

Browser check on `/home` (Movies, signed in with taste rail):

- Taste hero shows TMDb wordmark when available.
- Background YouTube trailer autoplays (muted) when available.
- Network tab: `title-logo` / `trailer` responses contain `logoPath` / `trailerKey` keys, not `error`.

Optional regression check:

```bash
curl -sS "https://cinema.sense.fans/api/community/month-recap?tz=Europe/Rome"
# Should not return NOT_FOUND if month-recap route is in the same deploy
```

### 4. Out of scope (this spec)

- UI/layout changes to `HomeTasteMatchedHero` (covered by `2026-07-02-home-taste-hero-media-fix-design.md`).
- Client/server hardening for `NOT_FOUND` with HTTP 200 (optional follow-up).
- Cloudflare Worker cutover (`api.sense.fans`) — same routes must exist on whichever host `API_REWRITE_ORIGIN` points at.

## Architecture (unchanged)

```
Browser → cinema.sense.fans/api/movies/:id/title-logo
       → Next rewrite (API_REWRITE_ORIGIN)
       → Elysia moviesRoute GET /:id/title-logo
       → resolveMovieTitleLogoPath → DB cache → tmdbApi.movieImages (if TMDB_API_KEY)
```

Taste hero also receives `logoPath` / `trailerKey` from `GET /api/taste/for-you` enrichment when the for-you response is built server-side; client fallbacks call the sub-routes when those fields are null.

## Success criteria

- `GET /api/movies/{id}/title-logo` and `/trailer` on production return route payloads (200 + `logoPath` / `trailerKey` keys), never `code: "NOT_FOUND"`.
- Taste hero on `/home` shows logo + trailer for titles that have TMDb assets (when `TMDB_API_KEY` is set).
- Local dev behavior unchanged.

## Rollback

If a bad API deploy ships, roll back the API Vercel deployment to the previous production build. Web project rollback does not affect API routes.
