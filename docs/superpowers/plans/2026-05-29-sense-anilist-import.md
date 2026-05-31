# SN.17.1 — Anilist JSON Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patrons upload Anilist anime list JSON in Settings; Sense maps entries to TMDb TV shows and creates watchlist, `tv_watch` + episode progress, and completion logs with scores.

**Architecture:** Canonical normalizer (`anilist-import-json.ts`) + tiered TMDb TV resolver (`resolve-anilist-tv-tmdb.ts`) + import orchestrator shared by route handler; mirror Letterboxd import guards and post-import hooks. UI sibling to `me-letterboxd-import.tsx`.

**Tech Stack:** Bun tests, Elysia, Drizzle, existing `ensureTvCached`, `tv_watch` / `tv_watch_episode` tables, TMDb search TV API.

**Spec:** [`docs/superpowers/specs/2026-05-29-sense-tier-3-anilist-design.md`](../specs/2026-05-29-sense-tier-3-anilist-design.md) (Phase A)

**Out of this plan:** SN.17.2 seasonal browse, SN.17.3 MAL enrichment, OAuth (SN.17.1b).

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/src/lib/anilist-import-json.ts` | Create | Parse JSON, adapters, dedupe keys, score mapping |
| `apps/server/src/lib/anilist-import-json.test.ts` | Create | Parser + adapter tests |
| `apps/server/src/lib/resolve-anilist-tv-tmdb.ts` | Create | TMDb TV search + optional cache read |
| `apps/server/src/lib/resolve-anilist-tv-tmdb.test.ts` | Create | Mock TMDb resolution |
| `apps/server/src/lib/anilist-import-apply.ts` | Create | Status → watchlist / tv_watch / log writes |
| `apps/server/src/lib/anilist-import-apply.test.ts` | Create | Mapping logic with mocked DB helpers |
| `apps/server/src/routes/import.ts` | Modify | `POST /api/import/anilist` |
| `apps/server/src/lib/record-product-event.ts` | Modify | Add `import_anilist_complete` kind if enum |
| `apps/web/src/components/profile/me-anilist-import.tsx` | Create | Settings upload UI |
| `apps/web/src/components/profile/settings-form.tsx` or account import section | Modify | Mount Anilist panel |
| `docs/superpowers/specs/2026-05-29-sense-tier-3-design.md` | Modify | SN.17 Wave E status |
| `.cursor/scratchpad.md` | Modify | SN.17.1 board |

---

## Phase 1 — Parse & normalize (TDD)

### Task 1: Canonical types + GraphQL adapter

**Files:**
- Create: `apps/server/src/lib/anilist-import-json.ts`
- Create: `apps/server/src/lib/anilist-import-json.test.ts`

- [ ] **Step 1: Write failing tests** for:
  - Canonical file with 2 entries normalizes scores (0–100 → tenths)
  - GraphQL-shaped payload (`lists[0].entries`) adapts to canonical
  - Manga entries filtered out (`media.type === MANGA'` → skip)
  - Dedupe key stable for same media + completed date

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
cd apps/server; bun test src/lib/anilist-import-json.test.ts
```

- [ ] **Step 3: Implement** `parseAnilistImportJson(text: string): AnilistImportEntry[]` + `anilistImportDedupeKey(entry)`

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 2: AniPort adapter (optional thin layer)

**Files:**
- Modify: `apps/server/src/lib/anilist-import-json.ts`
- Modify: `apps/server/src/lib/anilist-import-json.test.ts`

- [ ] **Step 1: Add test** with fixture resembling AniPort backup (`anime` array or nested lists)

- [ ] **Step 2: Implement** `normalizeAniPortBackup(raw: unknown): AnilistImportEntry[]` called from parser when shape detected

- [ ] **Step 3: Tests PASS**

---

## Phase 2 — TMDb resolution

### Task 3: Resolve Anilist media → TMDb TV id

**Files:**
- Create: `apps/server/src/lib/resolve-anilist-tv-tmdb.ts`
- Create: `apps/server/src/lib/resolve-anilist-tv-tmdb.test.ts`

- [ ] **Step 1: Write tests** with mocked `tmdbApi.searchTv`:
  - English title + year match
  - Fallback to romaji when english missing
  - Returns null when no results

- [ ] **Step 2: Implement** `resolveAnilistEntryToTmdbTvId(media): Promise<number | null>`

Use title preference: `english ?? romaji ?? native`; year from `startDate.year`; first search hit with year match else `[0]`.

- [ ] **Step 3: Tests PASS**

---

## Phase 3 — Apply import rows

### Task 4: Status mapping orchestrator

**Files:**
- Create: `apps/server/src/lib/anilist-import-apply.ts`
- Create: `apps/server/src/lib/anilist-import-apply.test.ts`

- [ ] **Step 1: Write tests** (mock DB + season episode list):
  - `PLANNING` → watchlist insert only
  - `COMPLETED` + score → log insert with tenths
  - `CURRENT` + progress 3 → tv_watch episode mode + 3 episode rows

- [ ] **Step 2: Implement** `applyAnilistImportForUser(userId, entries, { resolveTvId })` returning counts

Reuse patterns from `apps/server/src/routes/tv-watch.ts` for episode marking (extract shared helper if duplication > ~30 lines).

Episode walk: load seasons via `getTvSeasonsCached` + `getTvSeasonDetailCached`; iterate S1E1… until `progress` exhausted; skip season 0 unless only specials season.

- [ ] **Step 3: Tests PASS**

---

## Phase 4 — HTTP route

### Task 5: `POST /api/import/anilist`

**Files:**
- Modify: `apps/server/src/routes/import.ts`

- [ ] **Step 1: Add handler** mirroring `/letterboxd`:
  - Auth, rate limit `import:anilist:${user.id}`
  - Accept `file` JSON, 8MB cap
  - Parse → apply loop with `resolveAnilistEntryToTmdbTvId` + `ensureTvCached`
  - Return `{ imported, watchlist, watches, episodesMarked, skipped, unmatched, unmatchedTitles }`

- [ ] **Step 2: Call** `recomputeUserTasteSignature(user.id)` + `recordProductEvent` on success

- [ ] **Step 3: Manual smoke** (with dev server + sample JSON fixture)

```powershell
Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/import/anilist" -Form @{ file = Get-Item ".\fixtures\anilist-sample.json" } -UseBasicParsing
```

---

## Phase 5 — Web UI

### Task 6: Settings import panel

**Files:**
- Create: `apps/web/src/components/profile/me-anilist-import.tsx`
- Modify: settings import section (where `MeLetterboxdImport` lives)

- [ ] **Step 1: Clone structure** from `me-letterboxd-import.tsx` — accept `.json`, POST to `/api/import/anilist`, show result breakdown

- [ ] **Step 2: Copy** — anime/TV only; link to AniPort / GraphQL export instructions; “Connect Anilist (coming soon)” footnote optional

- [ ] **Step 3: Manual QA** in browser on `/me` or settings route

---

## Phase 6 — Docs & board

### Task 7: Close planning loop

**Files:**
- Modify: `docs/superpowers/specs/2026-05-29-sense-tier-3-design.md`
- Modify: `.cursor/scratchpad.md`

- [ ] Update tier-3 SN.17 row → spec approved, SN.17.1 in progress
- [ ] Add fixture `apps/server/src/lib/__fixtures__/anilist-sample.json` for tests (minimal 3-entry file)

---

## Verification gate (human)

- [ ] Upload real export → diary + watching progress visible on `/tv/[id]`
- [ ] Unmatched titles reported, no 500
- [ ] Reply **`ok`** on scratchpad SN.17.1

---

## Follow-on plans (separate)

- **SN.17.2:** `docs/superpowers/plans/YYYY-MM-DD-sense-anime-season-browse.md` (after 17.1 QA)
- **SN.17.3:** MAL enrichment plan (after 17.2 or parallel if no deps)
