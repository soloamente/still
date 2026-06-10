# Diary metal tier avatars (metal-fx)

**Status:** Approved (2026-06-10)  
**Date:** 2026-06-10  
**Topic:** Animated liquid-metal rings on patron avatars for high-volume diary loggers — silver, gold, chromatic presets with glow  
**Library:** [`metal-fx`](https://metal.jakubantalik.com/) (`MetalFx` — `preset="silver" | "gold" | "chromatic"`, `variant="circle"`, glow on)  
**Related:** `apps/server/src/jobs/seed.ts` (watch milestones) · `apps/web/src/components/profile/patron-portrait-avatar.tsx` · `apps/server/src/lib/profile-media.ts` · `apps/web/src/lib/use-software-gpu-rendering.ts`

## Summary

Patrons who log heavily in the diary earn a **visible metal tier** on their **avatar everywhere** it appears (feed, search, nav, profile hero, leaderboards, reviews, follows, account menu, etc.). Tiers map to existing watch-milestone thresholds:

| Tier | `MetalFx` preset | Diary log rows (non-removed) |
|------|------------------|------------------------------|
| — | none | &lt; 100 |
| Silver | `silver` | ≥ 100 |
| Gold | `gold` | ≥ 500 |
| Chromatic | `chromatic` | ≥ 1,000 |

Count metric is **total diary log rows** (rewatches included) — same as badge criteria `logs_count`, not deduplicated titles.

**Pro** (`isPro`) is unchanged and independent. Metal tier is a diary-volume signal, not a subscription perk.

## Problem

| Symptom | Root cause |
|---------|------------|
| Heavy loggers look identical to new patrons in feed/nav | No visual prestige for volume beyond hidden Achievements badges |
| Volume milestone badges exist but are off-profile | `badge-prestige` hides `watch_10` / `watch_100` / … from profile showcase by design |
| `profile.stats_cache` is empty in practice | Staff fix computes live counts; not suitable as tier source without a warmer |

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Surface | **All patron avatars** app-wide |
| Thresholds | **100 → silver**, **500 → gold**, **1,000+ → chromatic** (same at 5,000 for v1) |
| Count | **Total non-removed `log` rows** per patron |
| Performance | **Full `MetalFx` + glow** by default; **static CSS ring** when `prefers-reduced-motion` or software GPU |
| Tier data | **Server-derived `diaryMetalTier`** on every patron payload (recommended approach 3) |
| 5,000 “ultra chromatic” | **Out of scope v1** — same chromatic preset/strength as 1,000+ |

## Data model

### No new SQL columns (v1)

Tier is **derived at read time** from log counts. Optional v1.1: persist `diaryMetalTier` or `logsCount` in `profile.stats_cache` inside `badge-evaluator` snapshot — not required for launch.

### Shared types

```ts
/** Diary volume metal ring — null means no tier (< 100 logs). */
export type DiaryMetalTier = "silver" | "gold" | "chromatic";
```

Server: `apps/server/src/lib/diary-metal-tier.ts`  
Web mirror (types + static fallback tokens): `apps/web/src/lib/diary-metal-tier.ts`

### Resolver

```ts
export function resolveDiaryMetalTier(logsCount: number): DiaryMetalTier | null {
  if (logsCount >= 1000) return "chromatic";
  if (logsCount >= 500) return "gold";
  if (logsCount >= 100) return "silver";
  return null;
}
```

Unit-tested at boundaries: 99, 100, 499, 500, 999, 1000.

### Batch counts for lists

```ts
export async function fetchDiaryLogCountsForUserIds(
  userIds: string[],
): Promise<Map<string, number>>;
```

Single grouped query: `log.user_id`, `count(*)`, `removed_at IS NULL`, `user_id IN (...)`.

## API

### Patron profile slim shape

Extend `serializePatronProfileForClient` in `apps/server/src/lib/profile-media.ts`:

```ts
{
  handle: string;
  displayName: string;
  avatarIsAnimated: boolean;
  diaryMetalTier: DiaryMetalTier | null;
}
```

Populate `diaryMetalTier` via `resolveDiaryMetalTier(count)` when the caller passes a known count, or via batch map in list endpoints.

### Endpoints / payloads to extend

| Surface | File(s) | Notes |
|---------|---------|-------|
| Profile | `GET /api/profiles/:handle` | Include `diaryMetalTier` on profile or top-level stats |
| Feed | `apps/server/src/routes/feed.ts`, `feed-items.ts` | Batch counts for distinct `userId`s on the page |
| Activity divergence | `feed-rating-divergence.ts` | Patron rows in divergence cards |
| Profile search | `apps/server/src/routes/profiles.ts` search handler | Batch counts for result user ids |
| Leaderboards | `leaderboard-query.ts` + web rows/podium | Batch counts for ranked patron ids |
| Curator spotlights | `creator-recognition.ts` | Batch counts for spotlight ids |
| Follows drawer | follows list API | Batch counts |
| Following ratings | `movie-following-ratings.ts` | Batch counts for visible patrons |
| Reviews carousel / reader | review payloads with profile join | Per-author count or batch |
| Session / nav | App layout session user | Include `diaryMetalTier` for signed-in patron (from profile read or session enrich) |

**Null tier** when count &lt; 100 — clients render plain avatar (no wrapper).

## Web — display

### Dependency

Add to `apps/web/package.json`:

```bash
bun add metal-fx --filter web
```

### Wrapper component

Create `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx`:

- Props: existing `PatronPortraitAvatar` props + `diaryMetalTier?: DiaryMetalTier | null`
- When `diaryMetalTier` is null/undefined → render `PatronPortraitAvatar` only
- When tier is set and **full effects allowed** (`!reducedMotion && !softwareGpu`):

```tsx
<MetalFx preset={tier} variant="circle" strength={DIARY_METAL_STRENGTH[tier]}>
  <PatronPortraitAvatar {...props} />
</MetalFx>
```

Suggested strengths (tunable in playground):

| Tier | `strength` |
|------|------------|
| silver | `0.75` |
| gold | `0.85` |
| chromatic | `0.95` |

Glow: **on** (default library behavior; do not pass “no glow”).

- When **fallback** (reduced motion or software GPU): wrap portrait in a `rounded-full` container with tier-specific **static** ring classes from `diary-metal-tier.ts` (cool silver, warm gold, iridescent chromatic border — no shader).

Use existing hooks:

- `usePrefersReducedMotion` (create if missing — animated-profile-media plan adds one)
- `useSoftwareGpuRendering` from `@/lib/use-software-gpu-rendering`

### Call-site migration

Replace direct `PatronPortraitAvatar` usage with `PatronPortraitWithMetalTier` at all patron-facing surfaces (~20 files), passing `diaryMetalTier` from payload.

Keep `PatronPortraitAvatar` as the inner image primitive (no metal logic inside).

**Do not** wrap:

- `PersonCreditPortrait` (TMDb people — not patrons)
- Settings media customizer empty-state initials tile (unless product asks later)

### Profile hero note

`ProfilePatronHeader` uses a **rounded-2xl** poster frame (`ring-4 ring-card`), not a circle. For v1:

- Apply metal tier to the **same circular treatment as elsewhere** only if we switch hero to circle, **or**
- Wrap the existing rounded portrait in `MetalFx variant="circle"` inside the rounded clip (may clip shader) — **prefer**: use metal wrapper on the inner avatar with `rounded-2xl` on the outer shell and `variant="circle"` scaled to fit; validate visually in dev.

**Decision for implementer:** Profile hero uses `PatronPortraitWithMetalTier` with `className` preserving `rounded-2xl`; if `MetalFx` circle clashes with rounded-2xl frame, use static fallback ring on hero only while keeping shader circles elsewhere — document outcome in PR.

## Accessibility & performance

| Case | Behavior |
|------|----------|
| `prefers-reduced-motion: reduce` | Static tier ring, no shader |
| Software GPU (`useSoftwareGpuRendering`) | Static tier ring, no shader |
| Long feed scroll | One shader per visible avatar — acceptable for v1; revisit virtualization if profiling shows jank |
| Screen readers | No change to avatar `alt`/`aria-label`; metal is decorative |

## Out of scope (v1)

- Metal on handles, names, or non-avatar UI
- Staff panel tier preview override
- Separate 5,000-log preset or strength bump
- Real-time tier-up animation / toast
- Persisting tier in `stats_cache` (optional follow-up)
- Achievements UI copy linking metal tier to badges (nice-to-have)

## Testing

### Server

- `diary-metal-tier.test.ts` — threshold boundaries
- `fetchDiaryLogCountsForUserIds` — empty input, single user, batch map

### Web

- `diary-metal-tier.test.ts` — strength map, static ring class map
- Wrapper: renders `MetalFx` when tier + full effects; static ring when reduced motion mocked

### Manual

- Patron at 99 / 100 / 500 / 1000 logs — verify tier on profile, feed row, search row, nav
- Enable reduced motion — static rings only
- Software GPU probe — static rings only

## Success criteria

- Patrons at ≥100 logs show silver metal (or static silver ring under fallback) on **every** app avatar surface
- Tier upgrades at 500 and 1,000 without conflicting with Pro chip
- No N+1 count queries on feed pages (batch helper used)
- Reduced-motion and software-GPU patrons never run avatar shaders
