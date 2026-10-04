# Sense — Daily pick, whole-diary taste

**Status:** Draft for human review (brainstorm locked 2026-10-04)  
**Date:** 2026-10-04  
**Topic:** One Today / Watch tonight hero per calendar day, ranked from the full diary  
**Related:**  
- [`2026-09-23-today-on-sense-design.md`](./2026-09-23-today-on-sense-design.md)  
- [`2026-09-24-tv-today-on-sense-design.md`](./2026-09-24-tv-today-on-sense-design.md)  
- [`2026-09-23-watchlist-decision-engine-design.md`](./2026-09-23-watchlist-decision-engine-design.md)  
- [`2026-06-11-taste-for-you-algorithm-v2-design.md`](./2026-06-11-taste-for-you-algorithm-v2-design.md)

## Summary

**Today's Pick** on Movies and TV, and **Watch tonight** on the watchlist, each show one title for the calendar day in the viewer's timezone. The hero is chosen from the top matches for that day and stays until the date changes, **Pick another**, or **Not interested**. Logging the hero removes it and advances to the next candidate for the rest of that day.

The ranking behind the hero uses the **whole diary** for that media kind. Higher ratings count more. Older logs count the same as newer ones. The poster rail refetches after a log so the new rating joins the pattern and the logged title leaves the row. The hero does not jump to a new #1 mid-day just because the scores moved.

## Locked decisions

| Topic | Decision |
|-------|----------|
| Approach | Day-seeded pick from the top 12. No new database table |
| Surfaces | Movies Today, TV Today, Watch tonight — separate day pins |
| Day boundary | Viewer timezone already used by **Your week** (device cookie; UTC until that cookie exists) |
| Hero stability | Same title on reload for that `YYYY-MM-DD`. Tomorrow's date picks again |
| Skip | **Pick another** and **Not interested** skip that title until the date changes |
| After logging the hero | Drop it immediately and take the next remaining candidate for that day |
| Taste profile | Every non-removed diary log for that media. Rating weight stays. Recency decay goes away. The 400-newest cap goes away |
| Rail | Score order, minus the hero, logged titles, dismissals, and watchlist hard-excludes. Refetch after a log |
| Watch tonight taste | Its taste affinity uses the same whole-diary profile. "Recently added" stays a watchlist signal, not a diary-recency signal |
| Motion | Title and reason swap in place when the hero identity changes. Reduced motion swaps instantly |

## Problem

The for-you list is a stable sort, so the hero is always the current #1. The browser also pins that title for two hours (`still:today-pick:v1` / `:tv`). A new day does not rotate it. The taste profile multiplies each log by `recencyDecayByIndex` (newest 1.0, oldest in the batch 0.6) and only loads the **400** newest logs (`taste-matched-discovery.ts`, `taste-matched-discovery-tv.ts`). Loved titles from earlier in the diary never reach the pattern once the diary is longer than that window. The rail therefore looks stuck even after new logs.

## Goals / non-goals

**Goals**

- One hero per surface per calendar day, stable across reloads.
- A different hero when the date changes, without a manual skip.
- **Pick another** and **Not interested** advance inside that day's top 12.
- Suggestions reflect genres, decades, and languages across the full diary, with higher ratings pulling a category forward.
- The rail updates on the same visit after a diary save.
- Movies and TV stay separate. Watch tonight stays a watchlist hero.

**Non-goals**

- A stored daily pick on the server, or sharing one hero across devices.
- Reshuffling the entire poster rail at midnight.
- Weighting the last weeks of logs above the rest of the diary.
- Changing **Your week**, **From your circle**, catalogue shelves, or the for-you cold-start threshold.
- Rewriting social-neighbor or MMR diversity beyond what the new profile weights already change.

## Daily hero

### Day key

`dayKey` is `YYYY-MM-DD` in the timezone **Your week** already uses (`readViewerTimeZone` / the Today timezone cookie). UTC until that cookie exists.

### Choice

The server still returns the ranked unseen list (logged, dismissed, and watchlisted titles already removed).

A pure function picks the hero:

- Pool = the first **12** ids in score order. If fewer than 12 remain, use all of them.
- Start index = `djb2(userId + ":" + dayKey + ":" + surface)` modulo the pool length. `djb2` is the unsigned 32-bit string hash. `surface` is `movie`, `tv`, or `watchlist`. Client and tests share one helper.
- Walk forward from that index, skipping ids the patron skipped today.
- If a pin exists for this `dayKey` and that id is still in the pool and not skipped, keep it.
- If the pin was logged, dismissed, or is otherwise gone from the list, do not restore it. Take the next walk candidate and pin that.

### Browser pin

Replace the two-hour session pin with a local pin that lasts until `dayKey` changes:

| Surface | Key |
|---------|-----|
| Movies | `still:today-pick:v1` |
| TV | `still:today-pick:v1:tv` |
| Watch tonight | `still:watch-tonight:day:v1` |

Each value stores `dayKey`, `tmdbId`, and the ids skipped today. A mismatched or missing `dayKey` clears the pin. Detail continuity (the **Today's pick** line on the title page, and marking the pick done on the way back) keeps working for the pinned title during that day. It must not put a logged title back in the hero slot.

### Watch tonight

The pool is the ranked watchlist (existing tonight score). The day pin uses the same top-12 walk. Taste points inside that score come from the whole-diary profile. Points for a recently **saved** watchlist row stay as they are. Logging the spotlight skips it for the rest of the day even if the row is still on the watchlist.

## Whole-diary ranking

`buildWeightedTasteProfile` keeps `ratingAffinityWeight` (unrated 0.3, mid scores ramp, 9+ at 1.4). It stops multiplying by `recencyDecayByIndex`.

Movie and TV profile loads select the same scalar columns they select today (never whole-row `tmdb_json`) and include **every** non-removed diary log for that media. Drop `.limit(400)`.

The poster rail is that ranked list with the day's hero removed. After a diary create or edit, the existing consumed-title refetch runs again so the new rating is in the profile and the logged title is gone. The hero id stays pinned when it is still eligible.

A long diary moves slowly. One new log nudges the weights. It does not reshuffle the row.

Cold start is unchanged: below the existing minimum log count, there is no for-you hero or rail.

## Motion

When the hero title changes (new day, **Pick another**, **Not interested**, or the logged title advancing), the title and the one-line reason swap in place. `prefers-reduced-motion: reduce` swaps with no travel. Backdrop and trailer may crossfade. No full-page slide.

## Failure

- for-you or watchlist rank fails: keep the pin only when `dayKey` still matches and the title is still eligible. Otherwise the existing empty tile and **Try again**.
- Empty pool: existing empty state.
- Storage blocked: compute the day's hero from the hash each load. Skips last only for that page view.
- Timezone cookie appears or changes mid-day: `dayKey` may change and the hero may rotate early. That is acceptable.

## Tests

- Day-seed helper: same inputs return the same id; a different `dayKey` can return a different id; skipped ids are walked past; a pin wins while eligible; a pin absent from the pool does not return.
- Profile: two logs with the same rating and genre contribute the same weight regardless of order. A 9 outweighs a 6 on the same genre. Builder is called with a diary longer than 400 and the oldest log still affects the weight.
- Client pin: a stored `dayKey` from yesterday is dropped. Today's pin survives reload.

## Out of scope follow-ups

Sharing the day's hero across devices. Changing how many neighbors or how MMR diversity works. A separate "loved genres" label beyond the existing one-line reason.
