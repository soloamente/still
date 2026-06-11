# Taste For You — Algorithm v2 (Social-Augmented)

**Status:** Approved (brainstorm 2026-06-11)  
**Date:** 2026-06-11  
**Scope:** Signed-in **Movies For you rail** on `/home?browse=movies` (`HomeTasteMatchedRail`, `GET /api/taste/for-you`, dismiss replacement path)  
**Out of scope (v1):** TV For you rail, search/detail rec surfaces, per-title patron attribution, precomputed taste graph / nightly jobs, Settings UI for hidden suggestions

## Summary

Replace the current rule-based taste rail (genre frequency + top-500-popularity pool) with a **social-augmented blended scorer** that:

1. Weights diary taste by **ratings**, not just log count.
2. Draws candidates from **stratified genre pools** instead of a global popularity leaderboard.
3. Blends in **high-rated picks from taste-similar patrons** (followed first, overlap neighbors as backfill).
4. Applies **MMR diversity** so the 24-poster rail is not homogeneous.
5. Treats **Not interested** as a learning signal — forever-excludes the title **and** downranks similar future picks.

Goal: patrons — including niche-heavy diaries — see picks that feel personally curated, not a blockbuster echo chamber. Dismissing a bad suggestion should steer the rail away from that *kind* of pick, not just that one poster.

## Problem

Brainstorm confirmed three overlapping failures in today's rail:

| Failure | Root cause in current code |
|---------|---------------------------|
| Too many obvious blockbusters | Candidate pool = top 500 by `movie.popularity`; popularity adds up to +12 score |
| Wrong genre mix | Genre weights are log **frequency**; ratings collected but unused in `scoreCandidate` |
| Homogeneous row | Top 24 by score with no diversity pass — clustering is expected |

Product strategy (Section 5) calls for discovery that feels *"impossible to find elsewhere"* and *"popular among people with your taste profile."* The current solo genre matcher does not deliver that.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Primary surface | Movies **For you** rail only (`HomeTasteMatchedRail`) |
| Algorithm approach | **Blended scorer** (Approach 1) — request-time; no precompute in v1 |
| Social source | **Followed patrons first** → **taste-neighbors** (overlap backfill) → solo-only fallback |
| Neighbor criteria | ≥3 shared diary titles, ≥40% compatibility, public profile; max 20 neighbors |
| Social blend | **40% social / 60% solo** when ≥5 social candidates; else solo-only (no penalty) |
| Cold start | Unchanged: ≥10 movie logs; hide rail if &lt;6 results |
| Dismiss | Forever-exclude via `taste_dismissed_movie` **plus** negative scoring from dismiss history (see below) |
| API shape | Unchanged `{ coldStart, genrePhrase, movies }` |
| Rail copy | Keep dynamic genre phrase; optional subtitle **"From patrons with similar taste"** when social picks dominate (≥50% of final 24 sourced socially) |

## Scoring model

### Solo taste profile

Replace frequency-only weights with **rating-weighted affinity**:

- Each log contributes `affinity = ratingWeight(rating) × recencyDecay(watchedAt)`
- **`ratingWeight`** (after normalizing stored rating via `storedRatingToDisplayTen`):
  - null / unrated → `0.3`
  - ≤5.0 → `0.5`
  - 7.0 → `1.0`
  - ≥9.0 → `1.4`
- **`recencyDecay`**: linear from `1.0` (today) to `0.6` (400 logs ago) — mild bias toward recent taste without ignoring history
- Build genre / decade / language weights from **affinity sums**, not raw counts

**Niche calibration:**

1. Compute viewer median logged-title `movie.popularity` from their diary.
2. If viewer median &lt; platform median popularity (computed once per request from stratified pool sample or cached constant ~30), apply **niche boost** to candidates with popularity ≤ viewer p75: `+ affinity-matched-genre-score × 0.25`.

Niche patrons who log obscure titles should see obscure suggestions rank higher.

### Solo candidate pool

Replace single `ORDER BY popularity DESC LIMIT 500` with **stratified fetch**:

1. Rank genre affinities from weighted profile; take top 3.
2. Per genre: ~150 candidates where `genre_ids` contains genre id, ordered by **`popularity ASC`** within a band (mix deep cuts + mid-tier — not global top-N).
3. Cap total solo pool at ~450 titles.
4. **Fallback slice:** ~100 mid-popularity titles if a top genre returns &lt;50 rows.

**Popularity in solo score:** cap contribution at **+4** (down from +12) — tiebreaker only.

### Social signal

**Neighbor discovery** (extract shared helper from `suggested-patron-discovery.ts` → `taste-neighbor-discovery.ts`):

| Tier | Source | Notes |
|------|--------|-------|
| 1 | Followed patrons | All follows with movie diary signal |
| 2 | Taste-neighbors | Reuse overlap SQL + `computeTasteOverlap`; public profiles only |
| Cap | 20 neighbors | Ranked by `compatibilityPercent` desc |

Tier 1 neighbors always rank above tier 2 at equal compatibility.

**Social candidates** from neighbor diaries:

- Movie log rated ≥7.0 (display scale)
- Viewer has **not** logged or dismissed
- Neighbor log passes `contentVisibilityWhere(viewerId, neighborId, log.visibility)` — same rules as profile filmography / feed
- **Social score** per title: `max over neighbors(neighborCompatibility × neighborRatingWeight × recencyDecay)`

Titles can enter the pool exclusively via social signal (not required to be in solo stratified pool). Fetch metadata from `movie` table; skip if movie row missing.

### Merge + diversity

1. **Normalize** solo and social scores to 0–100 within each pool.
2. **Blend:** `finalScore = 0.6 × soloNorm + 0.4 × socialNorm` when ≥5 distinct social candidates; else `finalScore = soloNorm`.
3. Titles appearing in both pools use blended score (social can lift a weak solo match).
4. **MMR select 24** from sorted candidates:
   - `MMR = finalScore − λ × maxSimilarity(selected, candidate)`
   - Similarity: Jaccard on genre ids + same-decade bonus (λ = 0.35)
   - Stop at 24 or when pool exhausted
5. Require ≥2 distinct primary genre clusters in final 24 when input supports it (≥3 genre affinities with weight &gt; 0); otherwise best-effort.

**Dismiss replacement:** `scoreTasteMatchCandidatesForUser` returns full scored pool **before** MMR slice; `pickNextTasteMatchCandidate` picks highest-scored title not in on-screen + dismissed set. MMR applies only to the visible rail set in `buildTasteMatchedDiscovery`.

### Dismiss negative signal (Not interested matters)

Today dismiss only removes the exact TMDb id from the pool. v2 adds **two layered penalties** so patrons see fewer picks *like* what they rejected.

**Load dismiss history:** join `taste_dismissed_movie` → `movie` for up to **50 most recent** dismissals (ordered by `dismissed_at` desc). Each row supplies `genreIds`, `year`, `originalLanguage`, `popularity`.

#### Layer 1 — Per-candidate similarity penalty (always)

For each candidate, compute similarity to every dismissed title and subtract a capped penalty from `finalScore` **after** solo/social blend:

```
similarity(candidate, dismissed) =
  jaccard(candidate.genreIds, dismissed.genreIds) × 0.70
  + (sameDecade ? 0.20 : 0)
  + (sameOriginalLanguage ? 0.10 : 0)

dismissPenalty = max(similarity × 45) over dismissed titles
finalScore = max(0, blendedScore − dismissPenalty)
```

A dismiss on a 2010s English thriller downranks other 2010s English thrillers even if genre overlap is partial (Jaccard ~0.33 still hurts). Unrelated genres/decades feel little effect.

**Cap:** `dismissPenalty ≤ blendedScore × 0.55` — never zero a title that is otherwise a strong diary match.

#### Layer 2 — Genre cluster downweight (repeat signal)

When **≥2 dismissals** share a TMDB genre id, treat that genre as a weak negative preference:

- Build `negativeGenreWeights` from dismiss rows (each dismiss adds +1 per genre on that title).
- Genres with count ≥2 subtract from solo genre score: `−min(count × 3, positiveGenreWeight × 0.35)`.

One-off dismiss does **not** trigger layer 2 — avoids punishing an entire genre because of a single bad pick in a genre the patron loves.

#### Replacement on dismiss

`POST /api/taste/dismiss` persists the row, then re-runs the **full** scorer including the new dismiss in layers 1 and 2. Replacement should differ in genre cluster or decade when the pool allows — not another near-duplicate of what was dismissed.

### Genre phrase

Top 1–2 genre affinities from **positive weighted** profile → `"drama and thriller"`. Dismiss history never affects rail copy.

## Request flow

```
GET /api/taste/for-you
  │
  ├─1─ Load viewer diary slices (400 recent movie logs + movie metadata)
  │     └─ coldStart if < 10 movie logs
  │
  ├─2─ Build rating-weighted taste profile + niche calibration
  │
  ├─3─ Parallel fetch:
  │     ├─ Stratified solo candidates (~450 by top-3 genre affinities)
  │     ├─ Dismissed rows (ids + metadata, last 50) → negative profile
  │     ├─ Following user ids
  │     └─ Taste-neighbor ids (overlap → computeTasteOverlap → top 20)
  │
  ├─4─ Social candidates from neighbor rated logs (≥7.0, visibility-safe)
  │
  ├─5─ Score + merge (60/40 solo/social when ≥5 social candidates)
  │
  ├─6─ Apply dismiss penalties (similarity + repeat-genre downweight)
  │
  ├─7─ MMR diversity select → 24 titles
  │
  └─8─ Return { coldStart, genrePhrase, movies }
```

**Home RSC:** unchanged — `Promise.all` prefetch on `/home?browse=movies` when signed in.

**Dismiss path (`POST /api/taste/dismiss`):** reuses `scoreTasteMatchCandidatesForUser`; replacement from full scored pool excluding on-screen ids.

## Module structure

Refactor `apps/server/src/lib/taste-matched-discovery.ts`:

| Unit | Responsibility |
|------|----------------|
| `buildWeightedTasteProfile()` | Rating-weighted genre/decade/language + niche calibration |
| `buildDismissNegativeProfile()` | Last 50 dismiss rows → similarity helpers + repeat-genre weights |
| `applyDismissPenalties()` | Layer 1 similarity + layer 2 genre downweight on candidate scores |
| `fetchStratifiedCandidates()` | Per-genre pools, popularity cap |
| `resolveTasteNeighbors()` | Followed → overlap backfill → rank by compatibility |
| `fetchSocialCandidates()` | High-rated unseen titles from neighbors |
| `mergeAndScoreCandidates()` | Solo + social blend |
| `selectDiverseRail()` | MMR → 24 |
| `scoreTasteMatchCandidatesForUser()` | Orchestrator (for-you + dismiss) |

New shared lib: `apps/server/src/lib/taste-neighbor-discovery.ts` — extract overlap candidate SQL + neighbor ranking from `suggested-patron-discovery.ts`; both import from shared module.

## Performance budget

| Step | Target p95 |
|------|------------|
| Diary + weighted profile | ~50ms |
| Stratified candidates | ~80ms |
| Neighbor discovery | ~100ms |
| Social candidate batch query | ~80ms |
| Score + MMR (in-memory) | ~20ms |
| **Total** | **~330ms** |

Acceptable inside `/home` RSC `Promise.all`. If staging p95 &gt; 500ms, consider 1h neighbor-id cache (follow-up; not v1).

**Fallback on neighbor timeout/error:** log warning, serve solo-only + MMR — never fail the home page.

## Privacy & data boundaries

| Rule | Detail |
|------|--------|
| Stranger neighbors | `profile.isPrivate = false` only |
| Followed patrons | Respect `log.visibility` via `contentVisibilityWhere` |
| API response | No patron attribution in v1 — `{ tmdbId, title, posterPath, year }` only |
| Dismissals | Forever excluded from results; metadata feeds negative scoring (layers 1–2) |

## Error handling & fallbacks

| Condition | Behavior |
|-----------|----------|
| 0 neighbors | Solo-only scoring |
| &lt;5 social candidates | Skip social blend |
| &lt;6 results after MMR | `coldStart: true` — hide rail |
| Empty genre pool | Widen to next genre affinity or fallback slice |
| Social query failure | Solo-only; log error |

## Client changes (minimal)

| File | Change |
|------|--------|
| `home-taste-matched-rail.tsx` | Optional subtitle when `initial.socialDominant` — **defer** unless server adds optional field; v1 can omit UI subtitle and ship server-only |
| `taste-matched-discovery.ts` (web types) | Mirror any new optional analytics fields if added |

**v1 ships server-only** — no required web UI changes beyond type sync if optional metadata added later.

## Instrumentation

Extend `product_event` (no new tables):

| Event | When | Payload |
|-------|------|---------|
| `taste.for_you.served` | Rail returns ≥6 picks | `{ socialCount, soloCount, neighborCount, nicheBoostApplied, dismissCount }` |

Register kind in `product-event-kinds.ts`. Existing `taste.dismissed` unchanged.

## Testing

### Unit tests (pure, no DB)

- Rating-weighted profile — high-rated horror outweighs low-rated comedy
- Niche boost — low median-pop viewer ranks low-pop candidates higher
- Social merge — neighbor 9.0-rated unseen title outranks solo blockbuster
- MMR diversity — 24 picks span ≥2 genre clusters when input supports it
- Neighbor tiering — followed patron beats stranger at equal compatibility
- Dismiss similarity penalty — candidate sharing ≥2 genres + decade with dismissed title ranks lower than unrelated candidate at equal solo score
- Repeat-genre downweight — two dismissals in same genre reduce third candidate in that genre vs control
- Dismiss replacement — dismissed id excluded; replacement is not high-similarity to dismissed title when pool allows

### Integration tests (server)

- User with 15 logs + followed neighbors → non-empty rail, no logged/dismissed titles
- Niche diary (animation + foreign language) → results skew away from global top-pop only
- Zero neighbors → solo-only rail still returns ≥6 when catalogue supports it
- Private neighbor logs excluded from social candidates

## Verification (manual)

1. Sign in with ≥10 movie logs and varied ratings (not all 7+).
2. Open `/home?browse=movies` — For you rail shows titles aligned with **high-rated** genres, not just most-logged genres.
3. Compare with a blockbuster-heavy account vs niche account — niche account should see lower-popularity titles surface.
4. Follow a patron with overlapping taste — refresh rail; social picks should appear (check `taste.for_you.served` event `socialCount &gt; 0`).
5. Dismiss a title — replacement is not a near-duplicate (same genre cluster + decade); dismissed absent on hard refresh.
6. Dismiss two similar titles — third suggestion in that cluster should rank lower or disappear from top 24.
7. `bun test` in `apps/server` for new taste-matched-discovery tests.

## Future work

- TV For you rail (same scorer pattern, `tv` table + `tvId` logs)
- Per-title attribution ("@handle rated this 9.1")
- Precomputed neighbor cache if latency regresses
- Extend to search empty-state "Suggested for you" films (separate spec)

## References

- `apps/server/src/lib/taste-matched-discovery.ts` — current scorer
- `apps/server/src/lib/suggested-patron-discovery.ts` — overlap neighbor SQL
- `apps/server/src/lib/sense-taste-overlap.ts` — compatibility scoring
- `apps/server/src/lib/content-visibility.ts` — log visibility for social fetch
- `apps/server/src/lib/taste-dismissed-movie.ts` — dismiss + replacement
- `docs/superpowers/specs/2026-06-06-taste-rail-not-interested-design.md` — dismiss UX + persistence (negative scoring deferred there; **implemented in this spec**)
- `sense-media-platform-strategy.md` — Section 5 network effects, "this place knows me" moment
