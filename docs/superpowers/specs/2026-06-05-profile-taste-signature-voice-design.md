# Profile Taste Signature — Voice & Archetypes

**Status:** Approved (brainstorm 2026-06-05)  
**Date:** 2026-06-05  
**Scope:** Fix second-person copy on other patrons’ profiles; replace single template with archetype-driven, varied headlines (rule-based, no LLM)  
**Builds on:** `sense-taste-signature.ts`, `recompute-user-taste-signature.ts`, `ProfileTasteSignature`, `/og/taste/[handle]`, Sense Tier 0 taste identity

## Summary

Patrons see a taste headline under their name on profile (`ProfileTasteSignature`). Today every cached headline uses **“You gravitate toward…”**, which reads wrong when viewing **another** patron’s profile. Worse, almost everyone with enough logs gets the **same two templates** (gravitate + optional contrarian line, or “curator not completionist”).

This spec adds:

1. **Dual voice** — `headlineSelf` (second person) on own profile; `headlineVisitor` (third person, **no display name**) on others’ profiles and OG cards.
2. **Archetype classifier** — one primary taste pattern per patron (genre-purist, dual-affinity, contrarian, generous, selective, eclectic, curator, forming).
3. **Template library** — 2–3 distinct sentences per archetype; deterministic pick so copy is stable until taste meaningfully shifts.

Still **Tier 0 / rule-based** — no LLM, no new API routes.

## Problem

1. **Wrong audience** — Visiting `/profile/jdc` shows “You gravitate toward drama…” as if the viewer is jdc.
2. **Sameness** — Two outcome branches produce near-identical copy across unrelated patrons.
3. **OG share cards** — `/og/taste/[handle]` reuses stored `headline`, so shared images also say “You…” about someone else.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Visitor voice | **Third person, no name** — e.g. “Gravitates toward drama and animation…” (display name already in header) |
| Own profile voice | **Second person** — “You keep coming back to drama…” |
| Variation driver | **Taste archetypes** (user chose A) — not free-form signal weaving in v1 |
| Generation | **Rule-based templates** — no LLM |
| Storage | Extend `profile.taste_signature` JSON with `archetype`, `headlineSelf`, `headlineVisitor`; keep `headline` as alias → `headlineSelf` for backward compat |
| Template stability | Pick variant via hash of `(archetype, primaryGenre, secondaryGenre, logCountBucket)` — changes when taste shifts, not on every recompute jitter |
| Archetype priority | `forming` → `contrarian` → `genre-purist` → `dual-affinity` → `generous` / `selective` → `eclectic` → `curator` |
| Legacy rows | Parse old `{ headline }` as `headlineSelf`; derive visitor copy on read until next recompute |
| Recompute triggers | Unchanged — diary log CRUD, import, onboarding `POST /me/recompute-taste-signature` |
| UI layout | **Copy only** — keep `text-balance`, `font-editorial`, low-confidence `text-muted-foreground` |
| Out of scope v1 | Era-loyalist archetype, film/TV skew archetype, LLM copy, taste-compare UI changes |

## Archetypes

| Archetype | ID | Detection |
|-----------|-----|-----------|
| Forming | `forming` | `< 5` diary slices |
| Contrarian | `contrarian` | ≥ 3 rated slices with TMDb average; max \|user − TMDb\| ≥ **1.5** on 10-pt scale; example title available |
| Genre purist | `genre-purist` | Top genre ≥ **45%** of all genre tag hits |
| Dual affinity | `dual-affinity` | Top two genres ≥ **55%** combined; neither alone hits purist threshold |
| Generous | `generous` | ≥ **8** rated slices; mean user score ≥ **8.0** (10-pt) |
| Selective | `selective` | ≥ **8** rated slices; mean user score ≤ **6.5** (10-pt) |
| Eclectic | `eclectic` | Top genre share < **30%** |
| Curator | `curator` | Fallback when ≥ 5 slices and no other archetype matches |

**Confidence** (unchanged thresholds):

- `low` — &lt; 10 logs (includes `forming`)
- `medium` — 10–19 logs
- `high` — ≥ 20 logs

## Template examples

Each archetype defines `self[]` and `visitor[]` string templates. Placeholders: `{genre}`, `{genreA}`, `{genreB}`, `{title}`.

### forming

| Self | Visitor |
|------|---------|
| Your taste map is still forming — a few more logs and Sense can describe your lens. | Taste map still forming — not enough logs yet to describe a clear lens. |
| Sense is still learning your taste — log a few titles or import a diary to begin. | Taste map still forming — not enough logs yet. |

### genre-purist

| Self | Visitor |
|------|---------|
| You keep coming back to **{genre}** — it's the spine of your diary. | Keeps coming back to **{genre}** — it's the spine of this diary. |
| Your lens is unmistakably **{genre}**-first; everything else orbits around it. | Lens is unmistakably **{genre}**-first; everything else orbits around it. |

### dual-affinity

| Self | Visitor |
|------|---------|
| **{genreA}** and **{genreB}** show up together more than anything else in your log. | **{genreA}** and **{genreB}** show up together more than anything else here. |
| You pair **{genreA}** with **{genreB}** more than any other combination. | Pairs **{genreA}** with **{genreB}** more than any other combination. |

### contrarian

| Self | Visitor |
|------|---------|
| You often disagree with the crowd — *{title}* is a recent example. | Often disagrees with the crowd — *{title}* is a recent example. |
| You trust your own read over the consensus — *{title}* stands out. | Trusts their own read over the consensus — *{title}* stands out. |

### generous

| Self | Visitor |
|------|---------|
| You tend to find the good — your diary skews generous. | Tends to find the good — this diary skews generous. |
| High scores aren't rare in your log — you lead with enthusiasm. | High scores aren't rare here — leads with enthusiasm. |

### selective

| Self | Visitor |
|------|---------|
| You don't hand out tens lightly — high standards show in every score. | Doesn't hand out tens lightly — high standards in every score. |
| Your bar stays high — a low score from you actually means something. | The bar stays high — a low score here actually means something. |

### eclectic

| Self | Visitor |
|------|---------|
| Your taste doesn't sit in one lane — you chase variety over comfort. | Taste doesn't sit in one lane — variety over comfort. |
| No single genre owns your diary — you spread your attention wide. | No single genre owns this diary — attention spread wide. |

### curator

| Self | Visitor |
|------|---------|
| You watch widely but with intent — a curator's diary, not a checklist. | Watches widely but with intent — a curator's diary, not a checklist. |
| Your log reads like a program, not a pile — breadth with a point of view. | This log reads like a program, not a pile — breadth with a point of view. |

## Data model

```ts
export type TasteArchetype =
  | "forming"
  | "contrarian"
  | "genre-purist"
  | "dual-affinity"
  | "generous"
  | "selective"
  | "eclectic"
  | "curator";

export interface TasteSignaturePayload {
  archetype: TasteArchetype;
  headlineSelf: string;
  headlineVisitor: string;
  /** Backward compat — mirrors headlineSelf */
  headline: string;
  confidence: TasteSignatureConfidence;
}
```

Update `TasteSignatureJson` in `packages/db/src/schema/profile.ts` to match.

## Architecture

```
log rows (recompute)
    → TasteSignatureLogSlice[] (+ optional releaseYear, mediaKind for v2)
    → classifyArchetype(slices)
    → buildTasteProfileStats(slices)  // genre shares, avg rating, contrarian title
    → pickTemplate(archetype, stats, stableHash)
    → fillPlaceholders → headlineSelf + headlineVisitor
    → persist profile.taste_signature
```

**Web read path:**

```
profile.taste_signature
    → parseTasteSignatureJson (handles legacy)
    → resolveTasteHeadline(sig, "self" | "visitor")
    → ProfileTasteSignature
```

**Files:**

| Layer | File |
|-------|------|
| Server | `apps/server/src/lib/sense-taste-signature.ts` — classifier, templates, compute |
| Server | `apps/server/src/lib/sense-taste-signature.test.ts` — per-archetype tests |
| Server | `apps/server/src/lib/recompute-user-taste-signature.ts` — optional slice fields |
| DB types | `packages/db/src/schema/profile.ts` — `TasteSignatureJson` |
| Web lib | `apps/web/src/lib/sense-taste-signature.ts` — parse + resolve |
| Web UI | `apps/web/src/components/profile/profile-taste-signature.tsx` |
| Web UI | `apps/web/src/components/profile/profile-patron-header.tsx` |
| OG | `apps/web/src/app/og/taste/[handle]/route.tsx` |

## Error handling & edge cases

- **Empty diary** — `forming` archetype, low confidence, self/visitor forming copy.
- **No genre metadata** on logs — treat as `eclectic` or `curator` using `eclectic cinema` label only if no genre IDs at all.
- **Legacy JSON** — `{ headline, confidence }` only: use `headline` as self; run lightweight visitor transform (strip leading “You ” / “Your ”) only as read fallback until recompute.
- **Private profiles** — taste signature visibility unchanged (follows existing profile public gate).

## Testing

**Server unit tests (`sense-taste-signature.test.ts`):**

- One fixture per archetype with synthetic slices.
- Assert `headlineVisitor` contains no `\bYou\b` or `\byour\b` (case-insensitive).
- Assert stable template index for identical inputs across two calls.
- Assert priority: contrarian beats genre-purist when both signals present.

**Manual:**

- Own profile — second person, archetype-specific line.
- `/profile/[other]` — third person, no name.
- `/og/taste/[handle]` — visitor headline on card.

## Success criteria

1. No “You/your” on other patrons’ profile taste lines.
2. Patrons with different genre/rating patterns receive **different archetype labels** and **different template families** (not all “gravitate toward”).
3. Existing profiles backfill on next log/import/recompute without migration script.
4. OG taste cards show visitor voice.
