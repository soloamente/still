# Sense — TV Today on Sense

**Status:** Draft for human review (brainstorm locked 2026-09-24)  
**Date:** 2026-09-24  
**Topic:** The Movies Today block on TV Shows — its own pick, week, and circle, remembered separately  
**Related:**  
- [`2026-09-23-today-on-sense-design.md`](./2026-09-23-today-on-sense-design.md)  
- [`2026-06-11-taste-for-you-algorithm-v2-design.md`](./2026-06-11-taste-for-you-algorithm-v2-design.md)  
- [`2026-07-01-home-taste-hero-consumed-exclusion-design.md`](./2026-07-01-home-taste-hero-consumed-exclusion-design.md)

## Summary

Signed-in **TV Shows** on `/home` gets the same **Today on Sense** block as Movies: one pick, **Your week**, and **From your circle**. The TV block is about shows only. Movies keeps the Today it has now. Each tab remembers its own pick. **Continue watching** stays under the TV block. Community still has no Today.

This spec revises the Movies-only placement in the 2026-09-23 Today spec. It does not change movie pick, week, or circle behavior.

## Locked decisions

| Topic | Decision |
|-------|----------|
| Scope | Full Today on TV: pick, week, circle. All three are show-scoped |
| Movies | Unchanged reads, unchanged week (films and shows still mix), unchanged circle |
| Memory | Two picks. Switching Movies ↔ TV Shows restores each one |
| Watched | TV opens Quick Log (show selected; season or episode allowed). No instant save. No second “how was it” step |
| Exclusions | Any episode, season, or series log removes the whole show. Watchlist shows are out. Dismissals are per show |
| Cold start | Fewer than 10 **distinct** logged shows, or fewer than 6 results, shows the existing empty pick tile. Week and circle still render |
| Continue watching | Same rail, directly under the TV Today block |
| Motion | Page side-by-side on the Today block only, Movies ↔ TV Shows. Pill and catalogue stay instant |
| Community / search | No Today, same as today |

## Problem

The taste hero is the habit layer on Movies and is hidden on TV Shows. TV opens on **Continue watching** and the catalogue, so a patron who watches shows never gets a pick, a show-only week, or a circle card about shows. Extending the movie block without a second copy keeps one shell as the movie hero changes.

## Goals / non-goals

**Goals**

- TV Shows shows the same three cards, filled only with shows.
- A movie pick in progress is still there after a visit to TV Shows, and the reverse.
- **Watched** uses the existing TV Quick Log.
- Logged shows and watchlisted shows never appear in the TV pick.
- Movie Today, Community, catalogue search, and **Continue watching** keep their current jobs.

**Non-goals**

- A second hero component or a new aggregate `GET /api/today`.
- Changing the movie scorer, movie week, or movie circle.
- Filtering the movie week down to films only.
- Instant-saving a whole show from the hero.
- Replacing **Continue watching**, or putting it inside the poster rail.
- Showing Today on Community.
- A new recommendation model. TV reuses the movie scoring steps with show ids.

## Placement and motion

```text
/home  (signed in)
├── Movies     → Today media=movie
├── TV Shows   → Today media=tv
│                Continue watching
└── Community  → no Today
```

Catalogue search still replaces Today on either tab.

Switching **Movies** and **TV Shows** slides only the Today block with the transitions.dev page side-by-side transition (`t-page-slide`): films are page 1 and exit left, shows are page 2 and exit right. Duration stays on `--page-slide-dur` (200ms). `prefers-reduced-motion: reduce` cuts the slide. The browse pill and the catalogue keep the instant swap. Switching to or from Community hides or shows Today with no slide.

The active tab’s three reads start with the page. The other tab is prefetched after the active Today has painted, or when its browse pill is hovered. Movies does not wait on a TV taste query. A failed prefetch still slides; that side shows its empty or error tile.

## Architecture

One `TodayOnSense` shell takes `media: "movie" | "tv"`. Each card keeps its own Suspense boundary. The browse gate shows the matching page as soon as the pill changes, before the catalogue RSC finishes.

Both pages sit in the slide container while browse is Movies or TV Shows. Community and catalogue search unmount the container.

TV is three filtered reads on the existing routes, not a new module. Selects stay column-scoped. Do not read whole `tv.tmdb_json` rows.

## Data flow

| Read | Movies | TV Shows |
|------|--------|----------|
| Pick | `GET /api/taste/for-you` | `GET /api/taste/for-you?media=tv` |
| Your week | `GET /api/today/week` | `GET /api/today/week?media=tv` |
| Circle | `GET /api/today/circle` | `GET /api/today/circle?media=tv` |

Omitted `media` is the current movie behavior. `media=tv` is the only accepted filter. Any other value, including `media=movie`, is rejected with 400 so the movie path stays the one with no parameter.

The TV pick returns the same payload shape the hero already reads. Each title carries `mediaKind: "tv"` and links to `/tv/[id]`. Trailer, logo, and stills come from that show.

**Scoring.** Reuse the movie steps: diary profile, stratified catalogue candidates, social neighbors, MMR. Inputs are show ids.

- A diary row with a `tvId` counts toward that show, whatever the log scope (show, season, or episode). Genre and the other profile fields come from the show.
- Cold start is **10 distinct shows**, not 10 log rows. Ten episodes of one show do not unlock the pick. The movie scorer’s row count is unchanged.
- Logged show ids, watchlisted show ids, and dismissed show ids are hard-excluded.
- TMDb ids overlap between movies and shows. TV dismissals live in their own set. A TV dismiss must not hide a film, and a film dismiss must not hide a show.
- **Not interested** posts the existing dismiss route with exactly one of `movieTmdbId` or `tvTmdbId`, then advances the rail. A TV body writes only the TV dismissal set.

**Your week** with `media=tv` counts show, season, and episode logs in the patron’s Monday week and ignores films. The movie week is unchanged.

**From your circle** with `media=tv` is the latest visible followee log that has a `tvId`. No such log returns the current invite empty state. The movie circle is unchanged.

**Watched** calls Quick Log with that `tvId`, `logScope: "show"`, and `onSuccess`. The patron can switch to a season or an episode in the sheet. `onSuccess` marks the TV pick complete until **Pick another**, then refreshes the TV week. Closing the sheet without `onSuccess` leaves the pick active. Saving the show to the watchlist completes it the same way a film does.

**Continuity.** The movie key stays `still:today-pick:v1`, so a pick already in the session is kept. TV uses `still:today-pick:v1:tv`. Same two-hour TTL. On `/tv/[id]`, a matching TV pick shows the existing **Today’s pick** cue and reason line. Logging or watchlisting that show on the page completes the TV pick only.

TV product events for the pick include `media: "tv"`. Movie event payloads stay as they are.

## Screen behavior

The TV pick uses the movie band: trailer or stills, show logo, poster rail, **Not interested**, then **Your week** and **From your circle**. Supporting cards use show titles and posters. **Continue watching** is the next block, then the catalogue.

There is no inline “how was it” step on TV. Quick Log already collects the rating.

## Errors

A failed TV card does not take down the other TV cards or the movie Today.

| Case | Result |
|------|--------|
| Fewer than 10 distinct logged shows, or fewer than 6 results | Existing empty pick tile, with **Try again**. Week and circle still render |
| Pick request failed | Existing error tile and retry. No invented show |
| No TV logs this week | Existing empty week |
| Week request failed | Existing quiet week error |
| No visible followee show log | Existing invite |
| Circle request failed | “Couldn’t load activity from people you follow right now.” No fake invite |
| Quick Log save failed | Sheet’s own error. Pick stays active |
| Dismiss or watchlist failed | Existing toasts. The show stays in the rail |

## Testing

Movie cases stay green with no `media` parameter.

**Server**

- Show, season, and episode logs on one show count as one show, and that show is excluded from `for-you?media=tv`. A watchlisted show is excluded. A dismissed show is excluded.
- Fewer than 10 distinct logged shows returns `coldStart` and no titles. Ten episodes of one show stay in cold start. Six or more eligible shows return a pick.
- A TV dismiss does not remove that id from the movie rail, and a movie dismiss does not remove it from the TV rail.
- `week?media=tv` counts show, season, and episode logs and ignores films. The week with no `media` still includes both.
- `circle?media=tv` returns a show or the invite. A followee’s film log is not the TV card.
- Any `media` other than `tv` is 400 on all three routes.

**Web**

- The movie key and `still:today-pick:v1:tv` do not overwrite each other. Switching tabs restores each pick. Logging the show on `/tv/[id]` completes only the TV pick.
- The gate shows Today on Movies and TV Shows, and hides it on Community and during catalogue search.
- **Watched** opens Quick Log and does not instant-save. `onSuccess` shows **Pick another**. Dismissing the sheet leaves the pick up.
- The slide’s `data-page` follows the browse pill. Reduced motion does not slide. A movie home does not request `media=tv` until the TV pill is hovered or the movie Today has painted.

## Success criteria

On TV Shows, a patron with enough show history sees a show pick, a week of their TV logs, and at most one circle card about a show. **Watched** goes through Quick Log. Going back to Movies shows the film Today they left. **Continue watching** is still under the block. Community is unchanged.

## Out of scope

- Film-only filtering of the movie week and circle.
- Scoring changes beyond swapping in show ids and the distinct-show cold start.
- New Today cards (streaming alerts, next-episode picks, unfinished-list cards).
- Animating the catalogue or the browse pill with this transition.
