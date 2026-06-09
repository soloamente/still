# Letterboxd extended import (watchlist, reviews, likes) — Design

**Date:** 2026-06-09  
**Status:** Approved by user (brainstorming session)

## Goal

Extend the existing Letterboxd CSV import so patrons can upload their full export
folder in one pass — not only `diary.csv` and `ratings.csv`, but also
`watchlist.csv`, `reviews.csv`, and liked films (`likes/films.csv` as
`films.csv` in the file picker).

## Decisions made during brainstorming

| Question | Decision |
| --- | --- |
| Scope | All three new file types in **one upload** with diary (option A) |
| Likes mapping | **Favorite implies watched** — create minimal diary log + `log.liked` + Favorites list sync when no log exists (option B) |
| Reviews mapping | **Full review** — published `review` with body, rating, date; create minimal log when needed (option A) |
| Watchlist vs diary | **Skip** watchlist row when any diary log exists for that title (option A) |
| Re-import | **Merge updates** — skip dupes but fill missing ratings and refresh review text (option B) |
| Review visibility | Patron **`profile.default_visibility`** (option A) |
| Architecture | **`letterboxd-import-apply.ts` engine** + thin route (recommended approach #2) |
| ZIP upload | Out of scope for v1 |

## 1. Accepted CSV files & parsing

Patrons still use the multi-file picker (unzipped export folder). Files are
classified **by filename** (case-insensitive):

| Filename | Letterboxd zip path | Sense destination |
| --- | --- | --- |
| `diary.csv` | root | Diary `log` rows (existing) |
| `ratings.csv` | root | Merged into diary rows before insert (existing) |
| `watchlist.csv` | root | `watchlist_item` (films) |
| `reviews.csv` | root | `review` + linked `log` |
| `films.csv` | `likes/films.csv` | `log.liked` + system Favorites list |

**Ignored in v1:** `comments.csv`, `watched.csv` (diary supersedes), custom list
CSVs under `lists/`, `likes/reviews.csv`, `likes/lists.csv`, `profile.csv`,
`deleted/` and `orphaned/` subtrees.

**Shared row fields:** `Name`, `Year`, `Letterboxd URI` (+ file-specific columns).
TMDb resolution reuses the existing diary pipeline: DB cache by title/year →
TMDb search fallback.

**`reviews.csv` columns:** `Review` (body), `Rating`, `Rewatch`, `Watched Date`
/ `Date`, `Tags` (ignored v1).

**Import gate (UI):** At least **`diary.csv`** *or* one other recognized file must
be present (allows watchlist-only uploads without diary).

## 2. Import pipeline & merge rules

Single `POST /api/import/letterboxd` request, single rate-limit bucket (3/hour,
8MB total unchanged).

### Processing order

1. Parse & classify uploaded files by filename  
2. **Diary phase** — merge `diary.csv` + `ratings.csv` → insert/update `log`  
3. **Reviews phase** — each `reviews.csv` row with non-empty review body  
4. **Likes phase** — each `films.csv` row  
5. **Watchlist phase** — each `watchlist.csv` row  

Diary runs first so later phases can attach to logs created in step 2.

### Per-title log resolution (shared helper)

- **Match key:** Letterboxd URI → else `name + year` (lower-cased)  
- **Find existing log:** any `log` for `(userId, movieId)`; prefer latest
  `watchedAt` for updates  
- **Create minimal log** when likes/reviews need one and none exists:  
  - `watchedAt`: CSV `Watched Date` → `Date` → UTC noon on import day  
  - `rating`: from CSV stars if present, else null  
  - `watchVenue`: `streaming` (parity with current diary import)  
  - `note`: `Imported from Letterboxd (<uri>)` or `Imported from Letterboxd`  
  - `rewatch`: from CSV when present  

### Merge on re-import

| Entity | Skip when | Update when |
| --- | --- | --- |
| Diary log | Same calendar-day log already exists (current dedupe) | Existing log has **null rating** → fill from CSV; never overwrite non-null rating or `watchedAt` |
| Review | — | Match `(userId, movieId)` review: update **body** and **rating** if CSV differs; create if missing |
| Like | Already `log.liked` | Set `log.liked = true`; call `syncFavoritesListForUserTitle` |
| Watchlist | Any diary log for title exists | Skip duplicate `watchlist_item`; no field updates |

### Reviews

- Strip HTML from Letterboxd `Review` cell → plain text (paragraph breaks as
  `\n\n`); skip empty after strip  
- `containsSpoilers: false`; `title: null`  
- `publishedAt`: CSV `Date` or `Watched Date`, else linked log `watchedAt`  
- `visibility`: `profile.default_visibility` (fallback `public`)  
- `logId`: best-matching log (same watch day if possible, else latest for title)  
- Rating on review: from CSV; if absent, inherit from linked log rating when present  

### Likes

- Resolve TMDb id; ensure movie cached  
- Ensure log exists (minimal create if needed)  
- Set `liked: true` on log; `syncFavoritesListForUserTitle(userId, movieId)`  

### Watchlist

- Resolve TMDb id; skip if **any** `log` exists for `(user, movie)`  
- Skip if `watchlist_item` already exists for `(user, movieId)`  
- `addedAt`: CSV `Date` when parseable, else `now()`  

## 3. API response & side effects

### Extended JSON response

```ts
{
  diary: { imported: number; skipped: number; unmatched: number };
  watchlist: { imported: number; skipped: number; unmatched: number };
  reviews: { imported: number; updated: number; skipped: number; unmatched: number };
  likes: { favorited: number; logsCreated: number; skipped: number; unmatched: number };
  // Legacy top-level fields kept for backward compatibility:
  imported: number;   // diary.imported
  skipped: number;    // diary.skipped
  unmatched: number; // diary.unmatched
  totalRows?: number;
}
```

### Side effects

- `recomputeUserTasteSignature` when any diary log or review rating changed  
- In-app notification when anything imported:  
  “Letterboxd import complete — X diary · Y watchlist · Z reviews · W favorites”  
- `recordProductEvent(userId, 'import.letterboxd.completed', { …all counts })`  
- `prestige_diaries_merged` badge when `diary.imported > 0` (unchanged)  

## 4. Server module layout

| Module | Responsibility |
| --- | --- |
| `letterboxd-csv.ts` | Existing diary/ratings parser + merge (extend if needed) |
| `letterboxd-watchlist-csv.ts` | Parse `watchlist.csv` |
| `letterboxd-reviews-csv.ts` | Parse `reviews.csv` (+ HTML strip helper) |
| `letterboxd-likes-csv.ts` | Parse `films.csv` (likes) |
| `letterboxd-import-apply.ts` | Orchestrator: phases, TMDb resolve, DB writes, counts |
| `import.ts` route | Thin: auth, rate limit, form parse, delegate to apply |

Refactor existing diary loop out of `import.ts` into the apply module without
behavior regression.

## 5. Web UI (`me-letterboxd-import.tsx`)

- Expand **Files to include** checklist to five rows (table in §1)  
- Update step 3 copy: mention optional watchlist, reviews, liked films  
- Replace footer “not imported yet” with explicit in-scope / out-of-scope lists  
- **Result panel:** four count groups from extended response  
- Fetch stays on same-origin `/api/import/letterboxd` via `stillApiOrigin()`  
  (Next multipart proxy route — already required for production)  

## 6. Edge cases

- Unmatched TMDb: counted per phase; other phases continue  
- Films only — no TV in Letterboxd film CSVs  
- Review without rating: allowed  
- 8MB cap and 3/hour rate limit unchanged  
- Partial failure mid-orchestrator: best-effort sequential writes (Neon HTTP driver
  has no transactions); counts reflect what completed  

## 7. Testing

- **Unit:** new CSV parsers; HTML strip; merge helpers; filename classifier  
- **Unit:** orchestrator with mocked DB/TMDb — diary + watchlist skip + review
  create + like minimal log + favorites sync  
- **Regression:** existing `letterboxd-csv.test.ts` cases pass  
- **Manual:** full export folder on staging; re-import merge (rating fill, review
  body update)  

## 8. Out of scope (v1)

- ZIP upload / auto-extract  
- `comments.csv`, custom lists, liked reviews/lists  
- Letterboxd tags → Sense metadata  
- HTML-preserving reviews  
- TV titles in Letterboxd export (use Anilist import)  

## 9. Success criteria

- Patron uploads `diary.csv` + `watchlist.csv` + `reviews.csv` + `films.csv` in
  one action; all four destinations populated correctly  
- Watchlist skips titles already in diary  
- Liked films without diary rows get minimal logs and appear in Favorites  
- Reviews appear on profile/Community with correct visibility  
- Re-uploading the same export updates missing ratings and review text without
  duplicating rows  
- UI shows per-category counts; notification summarizes the import  
