# Diary TV Grouping (Flip Card)

**Status:** Draft — pending user review  
**Date:** 2026-05-20  
**Scope:** `/diary` lobby UX for multiple TV diary logs per series  
**Builds on:** Scoped TV logs (`log_scope`, `season_number`, `episode_number`), TV watching progress (`tv_watch` separate from diary), existing diary poster grid (`DiaryLobbyCatalogue` / `PopularMoviesInfinite`)

## Summary

Patrons with **more than one diary log** for the same series (e.g. “Season 1” + “Whole series”) currently see **duplicate posters** in the flat grid. Logs with `log_scope: show` show **no scope label**, which reads as a broken or “completed” tile next to a labeled **Season 1** entry.

This design **groups TV logs by series** into one grid cell, keeps **films as one tile per log**, and uses **in-place expand** (row-span) to list, edit, and collapse entries without leaving `/diary`.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Layout model | **Group by series** — one cell per `tvId` when 2+ logs (1 log may use same cell without count pill) |
| Expand interaction | **Flip card (approach 3)** — same grid footprint; front = poster + scope; back = log list |
| Not chosen | Row-span taller cell; overlay-only on poster |
| Films | **Unchanged** — one poster per `movieId` log |
| Collapsed label | **Never blank** — whole-show logs show **Whole series** on poster scrim |
| Primary collapsed line | **Most specific scope** among grouped logs: episode > season > show |
| Multi-log affordance | Pill **`N diary entries`** when count > 1 |
| Sort | Grid order by **latest `watchedAt`** in each group (same as current latest-seen intent) |
| Expanded actions | Row tap → Quick Log edit; optional delete; **Open series** → `/tv/[id]` |
| Single expanded | **One** expanded group at a time; collapse on second tap, other cell tap, or outside click |

## Problem

1. **Duplicate posters** for the same series confuse patrons (“did I finish it or log a season?”).
2. **Whole-show logs** have no visible scope on the poster (`formatTvLogScopeChip` returns `null` for `show`).
3. **No management surface** on `/diary` to see or edit multiple entries for one show without opening TV detail repeatedly.

## Goals

1. One **recognizable tile** per series in the diary grid.
2. **Explicit scope language** for every TV log (including whole series).
3. **In-grid management** — expand, review rows, edit, collapse — without a separate diary route per log.

## Non-goals (v1)

- Grouping movie logs by franchise or collection
- Merging or deduplicating logs in the database
- Replacing `tv_watch` progress UI on TV detail
- New API endpoints (client-side grouping of existing `GET /api/logs/me` rows)
- Diary sheet that navigates away from `/diary` (no full-page diary detail route in v1)

## Data & grouping

**Input:** Existing `DiaryLogRow[]` from `fetchMyLogsMeServer` after venue filter and sort.

**Group key:** `row.tv.tmdbId` (fallback: `row.log.id` if TV row missing listing — should not happen for `isDiaryLogWithListing` TV rows).

**Algorithm (client):**

1. Partition rows into `movieRows` (no `tv`) and `tvRows` (`tv` present).
2. Build `Map<tmdbId, DiaryLogRow[]>` for TV; preserve per-group sort by `watchedAt` desc.
3. Emit **grid items**:
   - Each movie row → `DiaryGridItemKind.single` (current behavior).
   - Each TV group → `DiaryGridItemKind.tvGroup` with `logs: DiaryLogRow[]`.
4. Sort grid items for lobby order:
   - `latest_seen` / `earliest_seen`: compare group’s latest (or only) `watchedAt`.
   - `title_az`: compare series title, then latest `watchedAt`.

**Venue filter:** Unchanged — if no log in a group matches venue, hide entire group (same as hiding a single row today).

## UI — Collapsed cell

**Structure:** Reuse `MoviePoster` shell (elevation lobby grid) inside a new `DiaryTvGroupCell` wrapper.

**Poster scrim (bottom gradient, existing pattern):**

- **Line 1:** Primary scope label from `pickPrimaryScopeLabel(logs)`:
  - Prefer any episode log (most recent episode by `watchedAt`) → `S01E03`
  - Else prefer season log → `Season 1`
  - Else → `Whole series`
- **Line 2 (only if `logs.length > 1`):** `2 diary entries` / `3 diary entries` — `text-xs`, muted on scrim

**Affordance:** Subtle chevron or `aria-expanded` on the cell; `cursor-pointer` on group wrapper.

**Navigation:** Collapsed poster tap **flips** the card; does not navigate to `/tv/[id]` (avoid accidental leave). **Open series** only on the back face.

## UI — Back face (flipped)

**Layout:** Same **2∶3** aspect as lobby posters; inner scroll for log rows when needed.

**Log list (below poster):**

| Column | Content |
|--------|---------|
| Scope | Chip: `Whole series` · `Season N` · `S01E03` |
| Date | Short watched date (tabular) |
| Rating | Stars or numeric if present |

- Rows sorted **newest first**.
- Row tap → `useQuickLog.open` with existing edit payload (scope fields included).
- Optional row action: delete log (confirm) → refresh via `router.refresh()` or optimistic remove.

**Footer:**

- Text button **Open series** → `/tv/[id]`
- Optional **Add diary entry** → Quick Log create with `tvId` prefilled

**Collapse:** Toggle on poster tap; clicking another group collapses previous; `useEffect` + document click for outside (respecting reduced motion).

**Motion:** Y-axis flip ~500ms (`rotateY`); respect `prefers-reduced-motion` (instant flip).

## Components (proposed)

| Unit | Responsibility |
|------|----------------|
| `diary-lobby-grouping.ts` | Pure functions: `groupDiaryRowsForLobby`, `pickPrimaryScopeLabel` |
| `DiaryTvGroupCell` | Collapsed + expanded UI, expand state |
| `DiaryLobbyCatalogue` | Map seeds → grid items; pass groups to custom renderer instead of flat `PopularMovieSeed[]` only |
| `DiaryLobbyGrid` (or extend `PopularMoviesInfinite`) | Render `single` vs `tvGroup` cells; flip state per group |

**Note:** May require a **diary-specific grid** rather than overloading `PopularMoviesInfinite` movie-only seeds — keep film path on existing poster component.

## Accessibility

- `aria-expanded` on group trigger
- Expanded list: `role="list"` / rows as `role="listitem"`
- Keyboard: Enter/Space toggle expand; Escape collapse
- Focus trap **not** required (inline expand, not modal)

## Error handling

- Empty group after filter: not rendered
- Single-log TV group: same cell UI without count pill; tap still expands to one row (optional: skip expand for 1 log and link straight to edit — **deferred**; v1 always allows expand for consistency)

## Testing

**Manual:**

1. Two logs same series (Season 1 + Whole series) → one tile, collapsed shows Season 1 + `2 diary entries`.
2. Expand → both rows labeled; edit Season 1 row opens Quick Log with scope prefilled.
3. One whole-show log only → scrim **Whole series**, no count pill.
4. Movie logs → still one tile per log, no grouping.
5. Venue chip theaters/streaming → group hidden if no matching logs.
6. Expand one group, tap another → first collapses.

## Relation to TV watching progress

- **`tv_watch`** progress remains on `/tv/[id]` — not shown on diary tile.
- **Mark season complete** diary CTA creates a **season** log — appears as a row in expanded list, not a second poster.
- Continue-watching rail (W.4) is separate from diary grouping.

## Open questions (none blocking spec)

- Auto-collapse on scroll: optional polish, not v1.
- Delete log from expanded row: include if delete already exists on API; otherwise edit-only v1.

## Approval

Brainstorm sign-off: grouping **B**, in-place **C**, flip **3** (two-face card), sections **1–3** approved 2026-05-20.
