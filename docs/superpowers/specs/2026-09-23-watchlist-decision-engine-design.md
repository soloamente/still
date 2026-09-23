# Sense — Watchlist decision engine

**Status:** Approved in brainstorm (2026-09-23) — awaiting written-spec review
**Date:** 2026-09-23
**Topic:** Turn `/watchlist` from storage into "what should I watch tonight?" — ranked mode, availability filter, TV continue-watching, per-title streaming alerts with a natural Attuned moment
**Related:**
- [`2026-09-23-today-on-sense-design.md`](./2026-09-23-today-on-sense-design.md) (slice 1 — this is later-slice #4)
- [`2026-07-04-sense-subscriptions-design.md`](./2026-07-04-sense-subscriptions-design.md) (plan tiers, `watchlist_alerts` feature)

## Summary

`/watchlist` keeps its poster-wall lobby and gains six mode chips:

**Watch tonight** · **Now available** · **Continue watching** · **Recently added** · **Oldest saves** · **By title**

Watch tonight re-orders the whole watchlist by a transparent score and shows one reason pill per tile. Now available filters to subscription streaming in the patron's region. Continue watching lists in-progress TV. Streaming alerts become requestable per title; free patrons get a real preview before an Attuned prompt.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Scope | All modes in one slice, including friend-recommendation and list-completion signals |
| Watch tonight | A mode chip that re-orders the full watchlist; **one** reason pill per tile (no separate hero band) |
| Architecture | **A** — server scores per request; pure scorer module; no stored score column, no new job |
| Free vs paid | Watch tonight + Now available **free**. Alerts stay **Attuned** (`watchlist_alerts`); free patrons see a preview first |
| Default mode | Stays **Recently added** (`latest_added`) — no change to the first view |
| URLs | `?order=` gains `tonight` · `available` · `continue`; existing `latest_added` · `earliest_added` · `title_az` unchanged |

## What exists (reuse)

- `GET /api/watchlist` — paginated, hide-watched (any live diary log drops the title), adult filter, `latest_added` / `earliest_added` / `title_az`, `streaming_provider_name` via `primaryFlatrateProviderName(tmdbJson, region)` on a narrow `WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION`.
- `readCatalogWatchRegionPref` (`profile.preferences.catalogTmdbWatchRegion`); `CatalogWatchRegionPrompt` on web.
- Streaming alerts: `watchlist-streaming-alerts.ts` job + `watchlist_streaming_snapshot`, global Settings toggle `preferences.watchlistStreamingAlerts`, gated by `patronHasPlanFeature(…, "watchlist_alerts")`, notification kind `watchlist_now_streaming`.
- `tv_watch` (status, `lastSeason`, `lastEpisode`, `notifyNewEpisodes`, `statusChangedAt`); `HomeContinueWatchingRail` on `/home?browse=tv`.
- `title_recommendation` (recipient, sender, movie/tv, `sensitiveScrub`, funnel timestamps); `canRecommendBetween` visibility gate.
- `list` / `list_item`; taste genre affinity in `taste-profile.ts`.
- Web lobby: `watchlist-lobby-order.ts`, `WatchlistCatalogOrderChips` (`SegmentedPillToolbar`), `CataloguePosterTile` + `RadialToolkit`, `watchlistStreamingLabel` pill.

## Modes

| Chip | `order` | Source | Sort |
|------|---------|--------|------|
| Watch tonight | `tonight` | watchlist (hide-watched) | score desc, then `addedAt` desc, then id |
| Now available | `available` | watchlist rows with a flatrate provider in region | `addedAt` desc |
| Continue watching | `continue` | `tv_watch` status `watching` \| `rewatching` | new-episode-available first, then `statusChangedAt` desc |
| Recently added | `latest_added` | watchlist | unchanged |
| Oldest saves | `earliest_added` | watchlist | unchanged |
| By title | `title_az` | watchlist | unchanged |

Chip labels change only (URLs stay). Continue watching comes from `tv_watch` because in-progress shows have diary logs and are therefore hidden from watchlist rows.

## Watch tonight scoring

Pure module `apps/server/src/lib/watchlist-tonight-score.ts` (unit-tested, no DB):

| Signal | Points | Reason pill (when strongest) |
|--------|--------|------------------------------|
| Flatrate provider in patron region | 40 | "Now on {provider}" |
| Received recommendation from a sender the viewer can still see | 30 (+5 per extra sender, cap 40) | "{name} recommended" / "{name} + N recommended" |
| Title is on one of the **viewer's own** lists and not yet watched | 20 | "Finishes {list title}" |
| Taste genre affinity (0–1 from `taste-profile`) | 0–20 | "Matches your taste" |
| Recency of save (linear over 30 days) | 0–10 | "Added recently" |

- Reason = the highest-contributing signal; ties break in table order. Score 0 → no pill.
- Candidate cap: the patron's 500 most recent watchlist rows (narrow selects only — never whole `movie` rows or full `tmdb_json`). Rank in TS, then page (`WATCHLIST_DEFAULT_LIMIT`). Cache the ranked id list per user for 60s (in-memory; Redis not required).
- Region unset → availability signal contributes 0 (no guess).

## Now available

- Rows where `primaryFlatrateProviderName(...)` is non-null for the patron region, applied **before** paging.
- Region unset → return `{ needsRegion: true }`; web shows `CatalogWatchRegionPrompt` affordance in the empty state instead of an empty grid.

## Continue watching

- `GET /api/watchlist/continue` — `tv_watch` rows for the viewer (`watching` | `rewatching`), adult filter applied, joined to `tv` for title/poster and a narrow `tmdb_json` projection of `last_episode_to_air` / `next_episode_to_air`.
- `hasNewEpisode` = latest aired `(season, episode)` > `(lastSeason, lastEpisode)`.
- Pill: "S{s} · E{e} next" (next unwatched aired episode) or "New episode" when detail is missing.

## Streaming alerts (per title)

- **Migration `0046_watchlist_item_streaming_alert`:** `watchlist_item.streaming_alert boolean not null default false`. Register in `_journal.json`.
- `PATCH /api/watchlist/alert` `{ movieId | tvId, enabled }` — owner only; **Attuned** required to enable (403 with the existing `planFeatureRequiredBody("watchlist_alerts", …)` shape, same as lists' `private_lists` gate).
- Job eligibility becomes: `watchlist_alerts` entitlement **and** (`preferences.watchlistStreamingAlerts` **or** `watchlist_item.streaming_alert`).
- UI: **Alert me when it streams** / **Stop alerts** in the watchlist `RadialToolkit` (hidden when already streaming in region).
- Free patron preview: tapping the action opens a small dialog — "{N} of your saved titles aren't streaming yet — Attuned tells you the day they land." with up to 3 posters (their own not-yet-streaming titles) + **See Attuned** → `/pricing`. No toggle is saved.

## UI states

| State | Behavior |
|-------|----------|
| Loading | Existing watchlist grid skeleton; chip row stays interactive |
| Empty — Watch tonight | "Save a few titles and we'll line up tonight's." + **Browse films** |
| Empty — Now available | Region unset: region prompt. Set: "Nothing on your services yet — we'll show titles here as they land." |
| Empty — Continue watching | "Start a show and it'll wait for you here." + **Browse TV** |
| Error | Inline "Couldn't load your watchlist" + **Try again**; chips remain |
| Stale chip | Keep existing `watchlistOrderGridIsStale` shimmer (no flash of previous mode) |

Reason pills reuse the existing tile streaming-pill slot (one line, truncate). Poster alt text unchanged; pills are included in the tile's accessible name.

## Privacy

- Friend reasons only for senders passing `canRecommendBetween(sender, viewer)` now; `sensitiveScrub` sends never show a name or title in the pill (they still count toward score).
- List reasons use the viewer's own lists only; never exposed to others.
- Adult titles follow `showAdultContent` in every mode.
- No new public surface.

## Instrumentation

New kinds (client-allowed unless noted):

| Kind | Properties |
|------|------------|
| `watchlist.mode_viewed` | `mode`, `count` |
| `watchlist.tile_action` | `mode`, `action` (open \| watched \| remove \| add_to_list), `reason` |
| `watchlist.alert_requested` | `enabled`, `listingKind` — **server-only** (recorded by `PATCH /alert`) |
| `upgrade.prompt_viewed` | `trigger` (`watchlist_alerts`) |

Watchlist → watched conversion: existing diary events joined to `watchlist.tile_action` by mode (analysis only).

## Testing

- Scorer: each signal, caps, tie-break order, missing region, sensitive send counts without a name.
- `parseWatchlistOrder` / `parseWatchlistLobbyOrder`: new values + legacy values + garbage → default.
- Friend-reason privacy: blocked / no-longer-visible sender excluded.
- Continue watching: new-episode detection edge cases (missing `last_episode_to_air`, season rollover).
- Alert PATCH: owner only, free → 403, Attuned → persists; job eligibility truth table.
- Web: empty/region-missing/error states per mode; free preview dialog opens without saving.

## Out of scope (later)

- Stored/precomputed scores or a scheduled ranker.
- Theater listings in Watch tonight.
- Group "watch together" planning.
- New-episode push notifications beyond existing `notifyNewEpisodes`.
- Recommendation dismiss / "not now" state (no field exists; recs keep counting until the title is watched or removed).
