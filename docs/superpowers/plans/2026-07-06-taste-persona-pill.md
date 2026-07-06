# Taste Persona Pill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven execution (one task per subagent; human **`go`** between tasks) or executing-plans for batch runs.

**Goal:** Replace abstract taste pills (*Genre-led*, *Dual affinity*) with genre-derived persona labels (*Dramatist*, *Dramatist & Toonist*, *Omnivore*) plus popover copy that names real genres.

**Architecture:** Curated TMDb genre → persona lexicon on the server; `computeTasteSignatureFromLogs` emits `pillLabel` + capitalized `pillGenres` alongside existing archetype/headlines; bump `TASTE_SIGNATURE_VERSION` to 4 so lazy recompute refreshes caches; web reads new fields for pill title and popover body.

**Tech Stack:** Bun tests, `sense-taste-signature.ts` (server + web mirror types), `ProfileTasteCategoryPill`, existing `taste-signature-cache.ts` version gate.

**Spec:** [`docs/superpowers/specs/2026-07-06-taste-persona-pill-design.md`](../specs/2026-07-06-taste-persona-pill-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/taste-persona-lexicon.ts` | Genre id → persona, eclectic pool, duo formatter, max length |
| `apps/server/src/lib/taste-persona-lexicon.test.ts` | Lexicon + `buildTastePillLabel` unit tests |
| `apps/server/src/lib/sense-taste-signature.ts` | Version 4, wire `pillLabel` + `pillGenres` into payload |
| `apps/server/src/lib/sense-taste-signature.test.ts` | Integration tests for compute output |
| `apps/server/src/lib/taste-signature-cache.ts` | No code change — version mismatch already triggers recompute |
| `apps/web/src/lib/sense-taste-signature.ts` | Parse `pillLabel`/`pillGenres`, `tasteSignaturePillLabel()`, genre-aware popover |
| `apps/web/src/lib/sense-taste-signature.test.ts` | Pill resolver + popover copy tests |
| `apps/web/src/components/profile/profile-taste-signature.tsx` | Use `tasteSignaturePillLabel` + new popover props |

---

### Task 1: Persona lexicon module (server)

**Files:**
- Create: `apps/server/src/lib/taste-persona-lexicon.ts`
- Create: `apps/server/src/lib/taste-persona-lexicon.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import {
  buildTastePillLabel,
  personaForGenreId,
  ECLECTIC_PERSONA_POOL,
} from "./taste-persona-lexicon";

describe("personaForGenreId", () => {
  test("maps drama to Dramatist", () => {
    expect(personaForGenreId(18)).toBe("Dramatist");
  });
  test("unknown id falls back to Cinephile", () => {
    expect(personaForGenreId(99999)).toBe("Cinephile");
  });
});

describe("buildTastePillLabel", () => {
  test("purist uses primary persona", () => {
    expect(
      buildTastePillLabel("genre-purist", {
        primaryGenreId: 18,
        secondaryGenreId: 35,
        tertiaryGenreId: null,
        logCount: 12,
      }),
    ).toBe("Dramatist");
  });
  test("dual uses ampersand duo", () => {
    expect(
      buildTastePillLabel("dual-affinity", {
        primaryGenreId: 18,
        secondaryGenreId: 16,
        tertiaryGenreId: null,
        logCount: 12,
      }),
    ).toBe("Dramatist & Toonist");
  });
  test("eclectic picks from pool stably", () => {
    const a = buildTastePillLabel("eclectic", {
      primaryGenreId: 18,
      secondaryGenreId: 35,
      tertiaryGenreId: 53,
      logCount: 15,
    });
    expect(ECLECTIC_PERSONA_POOL).toContain(a);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/server && bun test src/lib/taste-persona-lexicon.test.ts`

- [ ] **Step 3: Implement lexicon**

Implement per spec table (`Dramatist`, `Comedian`/`Comic`, `Nightwatcher`, `Toonist`, …). Export:

- `personaForGenreId(id: number): string`
- `shortPersonaForGenreId(id: number): string` (falls back to full persona)
- `buildTastePillLabel(archetype, { primaryGenreId, secondaryGenreId, tertiaryGenreId, logCount })`
- `buildEclecticPillLabel(stableKey: string)` using same hash approach as `stableTemplateIndex` in `sense-taste-signature.ts`
- `MAX_PILL_LABEL_LENGTH = 28` — when duo exceeds, use `shortPersona` for secondary

- [ ] **Step 4: Run — expect PASS**

Run: `cd apps/server && bun test src/lib/taste-persona-lexicon.test.ts`

---

### Task 2: Extend taste signature payload (server)

**Files:**
- Modify: `apps/server/src/lib/sense-taste-signature.ts`
- Modify: `apps/server/src/lib/sense-taste-signature.test.ts`

- [ ] **Step 1: Bump version + extend types**

```ts
export const TASTE_SIGNATURE_VERSION = 4;

export interface TasteSignaturePayload {
  // ...existing fields
  pillLabel?: string;
  pillGenres?: {
    primary: string;
    secondary?: string;
    tertiary?: string;
  };
}
```

- [ ] **Step 2: Add failing integration tests**

In `sense-taste-signature.test.ts`:

```ts
test("genre-led includes Dramatist pillLabel", () => {
  const result = computeTasteSignatureFromLogs([/* existing genre-led fixture */]);
  expect(result.version).toBe(4);
  expect(result.pillLabel).toBe("Dramatist");
  expect(result.pillGenres?.primary).toBe("Drama");
});
```

- [ ] **Step 3: Wire `buildTastePillLabel` + `buildPillGenres(stats)` in `buildPayload`**

- `buildPillGenres` capitalizes `genreLabel()` outputs (*Drama*, *Comedy*).
- Only set `pillLabel` for archetypes that show pills (`genre-purist`, `genre-led`, `dual-affinity`, `eclectic`).
- Omit for `forming`, `curator`, and legacy scoring archetypes not in pill surface.

- [ ] **Step 4: Run server taste tests**

Run: `cd apps/server && bun test src/lib/sense-taste-signature.test.ts src/lib/taste-persona-lexicon.test.ts`

Expected: all PASS

---

### Task 3: Web types + pill resolver

**Files:**
- Modify: `apps/web/src/lib/sense-taste-signature.ts`
- Modify: `apps/web/src/lib/sense-taste-signature.test.ts`

- [ ] **Step 1: Extend `TasteSignatureJson`**

```ts
export interface TasteSignatureJson {
  // ...existing
  pillLabel?: string;
  pillGenres?: {
    primary: string;
    secondary?: string;
    tertiary?: string;
  };
}
```

- [ ] **Step 2: Parse new fields in `parseTasteSignatureJson`**

- [ ] **Step 3: Add `tasteSignaturePillLabel(signature)`**

Returns `signature.pillLabel` when present, else `tasteArchetypeLabel(archetype)` fallback for legacy rows.

- [ ] **Step 4: Update `tasteArchetypeDescription`**

Add optional `pillGenres` param; for `genre-led`, body uses `{primary}`, `{secondary}`, `{tertiary}` from `pillGenres` instead of generic copy. Keep self/visitor voice.

- [ ] **Step 5: Tests**

```ts
test("tasteSignaturePillLabel prefers pillLabel", () => {
  expect(
    tasteSignaturePillLabel({
      archetype: "genre-led",
      pillLabel: "Dramatist",
      headline: "x",
      confidence: "medium",
    }),
  ).toBe("Dramatist");
});
```

Run: `cd apps/web && bun test src/lib/sense-taste-signature.test.ts`

---

### Task 4: Profile pill UI

**Files:**
- Modify: `apps/web/src/components/profile/profile-taste-signature.tsx`

- [ ] **Step 1: Pass full signature into pill**

- Label: `tasteSignaturePillLabel(tasteSignature)`
- `aria-label`: `` `${label}. Show what this means` ``
- Popover title: `label`
- Popover body: `tasteArchetypeDescription(archetype, perspective, tasteSignature.pillGenres)`

- [ ] **Step 2: Manual QA**

1. Open `/profile/jdc` (or any genre-led patron) — pill shows persona not *Genre-led*.
2. Tap pill — popover title matches pill; body names genres.
3. Own profile vs visitor — second vs third person in body.
4. Patron with dual-affinity — duo label on pill.

---

### Task 5: Verify recompute path

**Files:** (read-only check)

- `apps/server/src/lib/taste-signature-cache.ts` — `row.version !== TASTE_SIGNATURE_VERSION` already stale-triggers recompute.
- `apps/server/src/lib/recompute-user-taste-signature.ts` — confirm persisted JSON includes new fields.

- [ ] **Step 1: Run focused server suite**

Run: `cd apps/server && bun test src/lib/sense-taste-signature.test.ts src/lib/taste-persona-lexicon.test.ts`

- [ ] **Step 2: Optional local smoke**

Visit profile after deploy; confirm pill updates without manual recompute endpoint (lazy refresh).

---

## Success criteria

- [ ] Pill shows *Dramatist* (not *Genre-led*) for drama-led patrons with medium+ confidence.
- [ ] Dual patrons show *PersonaA & PersonaB*.
- [ ] Eclectic patrons show pool identity (*Omnivore*, etc.).
- [ ] Popover explains pattern with capitalized genre names.
- [ ] Legacy cached signatures fall back to archetype label until version-4 recompute.
- [ ] All new unit tests pass.

## Out of scope (this plan)

- OG taste card showing `pillLabel` (follow-up).
- Batch recompute script.
- Changing headline templates or archetype thresholds.
