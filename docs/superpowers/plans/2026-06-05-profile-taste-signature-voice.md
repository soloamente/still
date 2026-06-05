# Profile Taste Signature — Voice & Archetypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix taste headline voice on visitor profiles and replace monolithic “You gravitate…” copy with archetype-driven, varied self/visitor headlines.

**Architecture:** Extend `computeTasteSignatureFromLogs` with an archetype classifier and template library emitting `headlineSelf` + `headlineVisitor`. Web resolves headline by `isMe`; OG uses visitor voice. Legacy `{ headline }` rows parse until recomputed.

**Tech Stack:** Bun tests, Drizzle `profile.taste_signature` JSONB, Next.js App Router, existing `recomputeUserTasteSignature` hooks.

**Spec:** `docs/superpowers/specs/2026-06-05-profile-taste-signature-voice-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema/profile.ts` | `TasteSignatureJson` type with archetype + dual headlines |
| `apps/server/src/lib/sense-taste-signature.ts` | Classifier, templates, `computeTasteSignatureFromLogs` |
| `apps/server/src/lib/sense-taste-signature.test.ts` | Archetype + voice unit tests |
| `apps/web/src/lib/sense-taste-signature.ts` | Parse legacy + `resolveTasteHeadline` |
| `apps/web/src/components/profile/profile-taste-signature.tsx` | `perspective` prop |
| `apps/web/src/components/profile/profile-patron-header.tsx` | Pass `isMe ? "self" : "visitor"` |
| `apps/web/src/app/og/taste/[handle]/route.tsx` | Visitor headline on OG card |

---

### Task 1: DB type + shared archetype enum

**Files:**
- Modify: `packages/db/src/schema/profile.ts`
- Modify: `apps/server/src/lib/sense-taste-signature.ts` (export `TasteArchetype`)
- Modify: `apps/web/src/lib/sense-taste-signature.ts`

- [ ] **Step 1:** Add `TasteArchetype` union and extend `TasteSignatureJson` / `TasteSignaturePayload` with `archetype`, `headlineSelf`, `headlineVisitor`; keep `headline` as required alias for `headlineSelf`.
- [ ] **Step 2:** Update web `parseTasteSignatureJson` to accept new shape; legacy `{ headline, confidence }` maps to `headlineSelf = headline`, `headlineVisitor` via minimal fallback helper (strip “You ” / “Your ” prefixes only when dual fields missing).
- [ ] **Step 3:** Add `resolveTasteHeadline(sig, perspective: "self" | "visitor"): string | null`.

**Success:** Types compile in db, server, web packages.

---

### Task 2: Archetype classifier (TDD)

**Files:**
- Modify: `apps/server/src/lib/sense-taste-signature.ts`
- Test: `apps/server/src/lib/sense-taste-signature.test.ts`

- [ ] **Step 1: Write failing tests** — fixtures for each archetype:
  - `forming` — 3 slices
  - `genre-purist` — 12 slices all horror
  - `dual-affinity` — mixed drama + animation ~60%
  - `contrarian` — rated slices with gap ≥ 1.5
  - `generous` — 10 slices avg rating 8.5
  - `selective` — 10 slices avg rating 6.0
  - `eclectic` — flat genre distribution
  - `curator` — 12 slices moderate spread, no strong signal
- [ ] **Step 2: Run tests** — `cd apps/server && bun test src/lib/sense-taste-signature.test.ts` — expect failures.
- [ ] **Step 3: Implement** `buildTasteStats(slices)` (genre weights, shares, avg rating, contrarian title) and `classifyTasteArchetype(stats, slices)`.
- [ ] **Step 4: Run tests** — classifier tests pass.

**Success:** Each fixture maps to expected `archetype`.

---

### Task 3: Template library + dual headlines (TDD)

**Files:**
- Modify: `apps/server/src/lib/sense-taste-signature.ts`
- Test: `apps/server/src/lib/sense-taste-signature.test.ts`

- [ ] **Step 1: Write failing tests**
  - `headlineVisitor` has no `You` / `your` (regex).
  - Same input → same headline on two `computeTasteSignatureFromLogs` calls.
  - Different archetype fixtures → different headline families (not all containing “gravitate”).
- [ ] **Step 2: Run tests** — fail.
- [ ] **Step 3: Implement** `TASTE_ARCHETYPE_TEMPLATES`, `pickTemplateIndex(stableKey, poolLength)`, `renderTasteHeadlines(archetype, stats)`.
- [ ] **Step 4: Wire** `computeTasteSignatureFromLogs` to return full `TasteSignaturePayload`.
- [ ] **Step 5: Run tests** — all pass.

**Success:** `bun test src/lib/sense-taste-signature.test.ts` green.

---

### Task 4: Profile UI voice switch

**Files:**
- Modify: `apps/web/src/components/profile/profile-taste-signature.tsx`
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx`

- [ ] **Step 1:** Add `perspective: "self" | "visitor"` to `ProfileTasteSignature`; use `resolveTasteHeadline`.
- [ ] **Step 2:** Pass `perspective={isMe ? "self" : "visitor"}` from `ProfilePatronHeader`.
- [ ] **Step 3:** Manual check — own profile vs `/profile/[handle]`.

**Success:** Other profiles never show “You…”.

---

### Task 5: OG taste card

**Files:**
- Modify: `apps/web/src/app/og/taste/[handle]/route.tsx`

- [ ] **Step 1:** Replace `taste.headline` with `resolveTasteHeadline(taste, "visitor")`.
- [ ] **Step 2:** Verify fallback copy uses third person when API returns null.

**Success:** OG card shows visitor voice.

---

### Task 6: Verification

- [ ] **Step 1:** `cd apps/server && bun test src/lib/sense-taste-signature.test.ts`
- [ ] **Step 2:** `cd apps/web && bun run check-types` (or `bun run build` if types stale)
- [ ] **Step 3:** Trigger recompute on a dev patron (`POST /api/profiles/me/recompute-taste-signature`) and confirm JSON has `headlineSelf`, `headlineVisitor`, `archetype`.
- [ ] **Step 4:** `graphify update .` after code changes.

**Success:** Tests pass; manual profile + OG checks match spec.

---

## Notes for implementer

- Do **not** add LLM or new API routes.
- Reuse `ratingToDisplayTen` / genre label map — consider extracting shared `TMDB_GENRE_NAMES` later (YAGNI for this PR).
- `recompute-user-taste-signature.ts` may not need slice field changes for v1 — genre/rating/title suffice for all archetypes in spec.
- Keep template copy in `sense-taste-signature.ts` colocated with classifier for single-file testability; split only if file exceeds ~300 lines.
