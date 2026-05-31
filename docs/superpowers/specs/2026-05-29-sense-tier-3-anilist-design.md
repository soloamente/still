# Sense — Tier 3 Wave E (SN.17): Anime Depth & Anilist Import

**Status:** Approved (2026-05-29)  
**Parent:** [2026-05-29-sense-tier-3-design.md](./2026-05-29-sense-tier-3-design.md)  
**Strategy source:** [sense-media-platform-strategy.md](../../../sense-media-platform-strategy.md) §6 (anime wedge), §9 Tier 0 (Anilist import), Tier 3 (seasonal anime / episodic)

## Summary

SN.17 completes the strategy’s **anime wedge** without a separate `/anime` product. **Episodic TV progress already ships** (`tv_watch`, episode mode, Anime curated tags in ⌘K). This wave adds **Anilist migration**, then **seasonal browse**, then **MAL enrichment** — in that order.

**Decisions (locked in brainstorm):**

| Topic | Decision |
|--------|----------|
| Build order | **Phased bundle:** A import → B seasonal browse → C MAL enrichment |
| Import mechanism | **JSON upload first**; OAuth live sync deferred (SN.17.1b) |
| Import depth | **Diary + `tv_watch` progress** — scores, statuses, episode progress |
| Product surface | **No `/anime` app** — anime remains TV + curated discover |
| JSON strategy | **Canonical Sense schema** + normalizers; tiered TMDb TV match |
| Manga | **Out of scope** — movies + TV only |

## Problem

1. **Migration gap** — Letterboxd import covers film diary; anime-heavy patrons live on Anilist and cannot move lists/progress in one step (strategy §6, Tier 0).
2. **Seasonal discovery** — simulcast season browse is a core Anilist/MAL habit; Sense has Anime ⌘K wedge but no “this season” lobby.
3. **Metadata depth** — TMDb alone misses MAL community scores and airing nuance patrons expect on anime detail pages.

## Prerequisites

- TV progress stack shipped ([2026-05-20-tv-watching-progress-design.md](./2026-05-20-tv-watching-progress-design.md)).
- Letterboxd import pattern ([`POST /api/import/letterboxd`](../../../apps/server/src/routes/import.ts)).
- `ensureTvCached`, `tv_watch`, `tv_watch_episode`, scoped TV logs.

---

## SN.17.1 — Phase A: Anilist JSON import

### Goal

Patron uploads an Anilist anime list JSON in **Settings → Import**; Sense creates watchlist rows, `tv_watch` progress, and diary logs on TMDb-matched TV shows — then recomputes taste signature.

### Supported input formats

1. **Canonical Sense format** (documented below) — primary contract for tests and future OAuth normalizer.
2. **AniPort-style backup** — thin adapter if entry shape differs (normalize to canonical before import loop).
3. **Raw AniList GraphQL `MediaListCollection` export** — adapter maps `lists[].entries[]` to canonical rows.

Patrons without an official AniList “export folder” use community tools (AniPort, AniPy) or copy GraphQL JSON; Settings copy explains this (same tone as Letterboxd multi-file hint).

### Canonical entry shape (v1)

```ts
interface AnilistImportFile {
  version: 1;
  source: "anilist";
  entries: AnilistImportEntry[];
}

interface AnilistImportEntry {
  media: {
    anilistId: number;
    idMal?: number | null;
    title: {
      romaji?: string | null;
      english?: string | null;
      native?: string | null;
    };
    startDate?: { year?: number | null };
  };
  status:
    | "COMPLETED"
    | "CURRENT"
    | "PLANNING"
    | "PAUSED"
    | "DROPPED"
    | "REPEATING";
  score?: number | null; // 0–100, Anilist scale
  progress?: number | null; // episodes watched (Anilist episode counter)
  repeat?: number | null; // rewatch count hint
  startedAt?: string | null; // ISO date
  completedAt?: string | null;
}
```

Adapters accept AniList field names (`id` → `anilistId`, `idMal`, nested `media.title.romaji`, etc.) and emit this shape.

### Status → Sense mapping

| Anilist status | Watchlist | `tv_watch` | Diary `log` |
|----------------|-----------|------------|-------------|
| `PLANNING` | Add `watchlist_item` (`tvId`) | — | — |
| `CURRENT` | — | `watching`, episode mode | Optional: none until complete |
| `REPEATING` | — | `rewatching`, episode mode | On `COMPLETED`-equivalent only if import marks finished |
| `PAUSED` | — | `paused` | — |
| `DROPPED` | — | `abandoned` | — |
| `COMPLETED` | Remove if present | `finished` | Whole-show log (`log_scope=show`) + rating if `score` set |

**Episode progress (`progress > 0`):**

- Create/update `tv_watch` with `progress_mode = episode`.
- Mark episodes **S01E01 …** up to `progress`, walking TMDb season episode order (season 0 specials skipped unless only season).
- Cap at available aired episodes from cached season detail; if `progress` exceeds aired count, mark through last aired episode and set status from Anilist row (do not invent unaired episodes).
- For `COMPLETED` with `progress === 0`, treat as whole-show complete (season mode or full series complete via season-complete helper if all episodes aired).

**Scores:** Anilist 0–100 → stored rating tenths (`score` directly as tenths when 0–100, or map `/10` if adapter detects 1–10 — canonical uses 0–100 only).

**Rewatch:** `repeat > 1` or status `REPEATING` sets `log.rewatch = true` on imported completion logs; `tv_watch.status = rewatching` when in progress.

**Dedupe:** Stable key per user: `anilist:{anilistMediaId}:{status}:{completedAt day}` for logs; one `tv_watch` per `(user, tvId)`; skip duplicate watchlist rows.

### TMDb resolution (tiered)

For each entry, resolve `tmdbTvId`:

1. **Cache hit** — if `tv.tmdbJson` or future `external_id_map` has `anilistId` / `malId` → `tmdbId`, use it.
2. **Title search** — `tmdbApi.searchTv(preferredTitle, 1)` with `preferredTitle = english ?? romaji ?? native`; prefer result matching `startDate.year` when set.
3. **MAL-assisted search (optional v1.1)** — if `idMal` present and title search fails, Jikan/MAL title lookup → retry TMDb search (only if rate limits allow; not blocking SN.17.1 ship).

On failure: increment `unmatched`, append to import report (title + anilistId); do not fail whole import.

Always call `ensureTvCached(tmdbId)` before writes.

### API

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/api/import/anilist` | `multipart/form-data` field `file` (JSON); auth required |

**Response** (mirror Letterboxd):

```ts
{
  imported: number;      // logs created
  watchlist: number;
  watches: number;       // tv_watch created/updated
  episodesMarked: number;
  skipped: number;
  unmatched: number;
  unmatchedTitles?: { anilistId: number; title: string }[];
}
```

**Guards:** Same rate limit as Letterboxd (`3/hour/user`), max file size 8MB, JSON parse errors → 400.

**Side effects:** `recomputeUserTasteSignature`, `recordProductEvent('import_anilist_complete')`, optional in-app notification (reuse import-done kind if exists).

### Web UI

- **`me-anilist-import.tsx`** — sibling panel in Settings Import section next to Letterboxd.
- Copy: anime/TV only; link to how to generate JSON; show last import summary.
- No OAuth button in v1 (footnote: “Connect Anilist — coming soon” optional, not required).

### Out of scope (Phase A)

- Manga entries (reject or skip with message if file contains `type: MANGA`).
- Anilist reviews / custom list names as Sense lists.
- OAuth / scheduled sync (SN.17.1b).
- Undo import (same as Letterboxd — support path only).

### Success criteria

- [ ] Upload sample canonical JSON → ≥90% of entries with valid TMDb matches create expected rows in dev fixture set.
- [ ] `CURRENT` row with `progress: 12` → `tv_watch` episode mode with 12 episode marks.
- [ ] `PLANNING` → watchlist only, no spurious diary log.
- [ ] `COMPLETED` + score → whole-show log with rating tenths.
- [ ] Taste signature recomputes after import.
- [ ] Human QA: real AniPort/GraphQL export imports without server error.

### Tests

- `anilist-import-json.test.ts` — parse adapters, dedupe keys, score mapping.
- `resolve-anilist-tv-tmdb.test.ts` — mock TMDb search, cache hit path.
- Route integration test with mocked `ensureTvCached` + DB (pattern from `lists.test.ts`).

---

## SN.17.2 — Phase B: Seasonal anime browse

### Goal

When patron browses **TV** with **Anime** curated context, offer a **This season** slice — airing and recently started simulcasts — without a new route.

### Scope

- **Home / TV discover** preset: `genre=16`, `with_status=0` (returning), `first_air_date.gte` = start of current cour (computed: Jan/Apr/Jul/Oct windows or rolling 90 days — pick **rolling 90 days** for v1 simplicity).
- Surface as chip or sub-sort on existing TV lobby when Anime tag active in ⌘K is **not** required here — optional **Community/TV home** chip “Airing now” visible when `browse=tv` + user has anime genre filter or dedicated query param `?animeSeason=1`.
- Reuses existing discover API; no MAL.

### Success criteria

- [ ] Chip loads grid of currently airing animation TV from TMDb discover.
- [ ] No new top-level nav; stays under `/home?browse=tv`.

### Defer

- Cour calendar UX (Winter 2026 picker) — v2.
- Separate `/anime` marketing page.

---

## SN.17.3 — Phase C: MAL enrichment on TV detail

### Goal

When TMDb TV maps to a MAL id, show **secondary metadata** on `/tv/[id]`: MAL score, MAL rank/popularity, airing status string.

### Scope

- Store `malId` on `tv` row or `tv.tmdbJson.external_ids` after first successful match (import or manual backfill job).
- Read-only MAL API or Jikan (`/anime/{id}`) with server-side cache TTL 7d.
- UI: one line in About or meta strip — **not hero**; fails closed (hide block if no MAL id).
- Improves future import matching (cache `malId → tmdbId`).

### Success criteria

- [ ] Known show (e.g. popular anime) shows MAL score when `malId` known.
- [ ] No MAL id → no empty chrome.

### Out of scope

- MAL as primary catalogue source.
- MAL reviews or forum links.

---

## SN.17.1b — Optional: Anilist OAuth (deferred)

- OAuth connect in Settings; pull `MediaListCollection` via GraphQL with token.
- Reuse **same normalizer + import loop** as file upload.
- Ship only if JSON upload volume / support burden justifies it.

---

## Architecture diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ Settings upload │────▶│ parse + normalize    │────▶│ resolveTvTmdbId │
│ (JSON)          │     │ anilist-import-json  │     │ (search+cache)  │
└─────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                              │
                    ┌─────────────────────────────────────────┼─────────────────────────┐
                    ▼                     ▼                   ▼                         ▼
             watchlist_item          tv_watch          tv_watch_episode            log (scoped)
                    │                     │                   │                         │
                    └─────────────────────┴───────────────────┴─────────────────────────┘
                                                              │
                                                    recomputeUserTasteSignature
```

---

## Monetization & product guardrails

- Import remains **free** (strategy §12 — never paywall log/review/social).
- Seasonal browse is discovery, not Pro-gated.
- MAL enrichment is utility on detail, not Pro-gated.

---

## Human QA checklist (Phase A)

1. Export anime list via AniPort or sample JSON → upload in Settings.
2. Confirm **Planning** titles on watchlist, **Completed** in diary with scores.
3. Confirm in-progress title shows **Watching** on `/tv/[id]` with episode checkmarks.
4. Profile taste signature updates.
5. Unmatched report lists unknown titles without 500 error.

---

## References

- [2026-05-29-sense-product-roadmap-design.md](./2026-05-29-sense-product-roadmap-design.md) §1.2 Bulk import
- [2026-05-20-tv-watching-progress-design.md](./2026-05-20-tv-watching-progress-design.md)
- AniList API: https://docs.anilist.co/
