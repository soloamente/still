# Letterboxd `watched.csv` gap-fill import — Design

**Date:** 2026-06-10  
**Status:** Approved  
**Related:** `2026-06-09-letterboxd-extended-import-design.md` (supersedes “ignored watched.csv” for v1)

## Problem

Letterboxd exports include `watched.csv` — a deduplicated list of films the patron
has marked as watched (`Date,Name,Year,Letterboxd URI`), including titles **without**
a corresponding row in `diary.csv`.

Sense’s Letterboxd import currently **ignores** `watched.csv`. Patrons who upload
their export folder see a successful import but **missing diary entries** for
watched-only titles (e.g. films logged as “watched” on Letterboxd without a diary
entry).

**Observed example** (`letterboxd-adgv-2026-05-30-01-03-utc`):

| Title | `watched.csv` | `diary.csv` | `ratings.csv` |
| --- | --- | --- | --- |
| One Battle After Another (2025) | yes | no | no |
| Fight Club (1999) | yes | no | yes |

Fight Club can still import via `ratings.csv` in the diary phase; One Battle After
Another has no import path today.

## Goal

Recognize `watched.csv` and **gap-fill** diary logs for titles not already present
in the patron’s Sense diary after the normal diary import — without duplicating
rewatches or conflicting with existing merge rules.

## Decisions (brainstorming)

| Question | Decision |
| --- | --- |
| Symptom | Import succeeds but specific titles missing from diary |
| Behavior | **Fill gaps only** — create a log only when no existing log for that film |
| Architecture | **Gap-fill phase after diary** (recommended approach #1) |
| First-watch backfill when diary has only rewatches | **Out of scope** (deferred) |
| `orphaned/` / `deleted/` subtrees | Ignored (unchanged) |

## 1. Accepted file & parsing

| Filename | Letterboxd path | Sense destination |
| --- | --- | --- |
| `watched.csv` | export root | Diary `log` rows (gap-fill only) |

**Columns:** `Date`, `Name`, `Year`, `Letterboxd URI` (no `Rating`, `Rewatch`).

**Parser:** Reuse existing `parseLetterboxdCsv` — already matches `Date` as watch
date and optional rating columns.

**Classifier:** Extend `LetterboxdCsvKind` with `"watched"`; map basename
`watched.csv` (case-insensitive).

**Import gate:** `watched.csv` alone counts as a recognized file (same as
watchlist-only uploads).

## 2. Pipeline & merge rules

### Processing order (updated)

1. Parse & classify uploaded files  
2. **Diary phase** — `diary.csv` + `ratings.csv` → merge → insert/update logs
   (unchanged)  
3. **Watched gap-fill phase** — `watched.csv` → insert logs for uncovered titles
   (**new**)  
4. Reviews → Likes → Watchlist (unchanged)

Watched runs after diary so step 3 sees logs created in step 2.

### Per-row logic (watched gap-fill)

| Step | Rule |
| --- | --- |
| Dedupe within file | `letterboxdTitleMatchKey` (URI preferred, else name + year) |
| TMDb resolve | Reuse `resolveLetterboxdMovieTmdbId` |
| Skip — already logged | **Any** `log` for `(userId, movieId)` via `anyLogExistsForMovie` |
| Skip — duplicate row | Second row with same match key in `watched.csv` |
| Insert | `createMinimalLetterboxdLog` |

### Log fields on insert

- `watchedAt`: CSV `Date`; fallback UTC noon on import day  
- `rating`: null (ratings from overlapping `ratings.csv` rows are applied in diary
  phase, not watched phase)  
- `rewatch`: false  
- `watchVenue`: `streaming` (parity with diary import)  
- `note`: `Imported from Letterboxd (<uri>)` or generic import note  

### Re-import

Idempotent: titles with any existing log are skipped (`skipped` count). No
overwrite of `watchedAt` or rating on re-upload.

### Overlap examples

- **Fight Club** in `ratings.csv` + `watched.csv`, not `diary.csv`: diary phase
  creates log from ratings merge; watched phase skips.  
- **One Battle After Another** in `watched.csv` only: watched phase creates one
  log.  
- Title with rewatch entries in `diary.csv`: watched phase skips (any log exists).

## 3. API response & UI

### Extended JSON response

Add:

```ts
watched: { imported: number; skipped: number; unmatched: number }
```

- `imported` — new diary logs from watched gap-fill  
- `skipped` — any log already existed, or duplicate row in file  
- `unmatched` — TMDb resolution failed  

`totalRows` includes watched row count. Legacy top-level `imported` / `skipped` /
`unmatched` remain **diary-phase only** (unchanged).

**Side effects:** Include `watched.imported` in product event payload and import
notification summary when > 0.

### Web UI (`me-letterboxd-import.tsx`)

- Add `watched.csv` to recognized files set and optional picker row  
- Copy: *“Films marked watched without a diary entry — fills gaps after diary
  import”*  
- Step 3 instructions mention `watched.csv`  
- Toast / result panel: show watched counts when `watched.imported > 0`  

## 4. Server module layout

| Module | Change |
| --- | --- |
| `letterboxd-file-classifier.ts` | Add `"watched"` kind for `watched.csv` |
| `letterboxd-import-apply.ts` | `applyWatchedGapFillPhase()`; wire after diary phase |
| `letterboxd-csv.ts` | No change (reuse parser) |
| `letterboxd-import-log-resolve.ts` | Reuse `anyLogExistsForMovie`, `createMinimalLetterboxdLog` |
| `import.ts` route | Pass through extended response fields |
| `me-letterboxd-import.tsx` | Recognize file + display counts |

## 5. Edge cases

- **Unmatched TMDb:** counted in `watched.unmatched`; other phases continue  
- **Watched-only upload:** valid — gap-fill creates logs for all resolvable titles  
- **8MB cap / 3 per hour rate limit:** unchanged  
- **Partial failure:** best-effort sequential writes (no DB transactions on Neon
  HTTP driver)  
- **Sense export `watched.csv`:** uses `TMDb ID` column, not Letterboxd URI — not
  targeted by this change (Letterboxd → Sense import only)

## 6. Testing

| Target | Cases |
| --- | --- |
| `letterboxd-file-classifier.test.ts` | `watched.csv` → `"watched"` |
| `letterboxd-import-apply` (unit/integration) | Creates log for watched-only title; skips when diary log exists; skips duplicate URI; `unmatched` when resolver returns null |
| Fixture | Pattern from real export: watched-only title + watched+ratings overlap |

Regression: existing diary / extended import tests pass unchanged.

## 7. Out of scope

- First-watch backfill when `diary.csv` contains only rewatch rows (option C)  
- `orphaned/watched.csv`, `deleted/` subtrees  
- Merging watched into diary batch pre-insert (rejected approach #2)  
- ZIP upload  

## 8. Success criteria

- Patron uploads export including `watched.csv`; titles present only in watched
  appear in Sense diary after import  
- Titles already imported via diary/ratings are not duplicated  
- Re-import of same export is idempotent for watched gap-fill  
- UI lists `watched.csv` as optional file and reports watched import counts  
- One Battle After Another–style watched-only titles import when TMDb resolves  
