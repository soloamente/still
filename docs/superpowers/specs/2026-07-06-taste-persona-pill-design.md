# Taste Persona Pill — Genre-Based Profile Labels

**Status:** Approved (brainstorm 2026-07-06)  
**Date:** 2026-07-06  
**Parent:** [2026-06-05-profile-taste-signature-voice-design.md](./2026-06-05-profile-taste-signature-voice-design.md)  
**Builds on:** `apps/server/src/lib/sense-taste-signature.ts`, `apps/web/src/lib/sense-taste-signature.ts`, `ProfileTasteCategoryPill`

## Summary

Replace abstract taste pill labels (**Genre-led**, **Genre purist**, **Dual affinity**, **Eclectic**) with **patron-facing persona names** derived from diary genres — e.g. **Dramatist**, **Dramatist & Animator**, **Omnivore**. The **headline** under the profile stays genre-descriptive (unchanged templates). The **pill** becomes taste identity; the **popover** keeps the pattern explainer and names the actual genres from TMDb tags.

**Approach:** Curated persona lexicon (rule-based, no LLM) computed at taste-signature time and stored as `pillLabel` on the cached JSON payload.

## Brainstorm decisions (locked)

| Topic | Decision |
|-------|----------|
| Scope | **Pill + popover title** — not a full archetype taxonomy rename in patron UI |
| Naming style | **Identity nouns** (*Dramatist*), not classifier jargon (*Genre-led*) |
| Purist / led | **Same pill rule** — primary genre persona; popover + headline convey strength |
| Dual affinity | **`{Primary} & {Secondary}`** persona duo, ordered by genre weight |
| Eclectic | **Non-genre identity** from a small fixed pool (*Omnivore*, *Restless viewer*, …) |
| Forming / low confidence | **No pill** (unchanged — `shouldShowTasteArchetypePill`) |
| Generation | **Server at compute** — `pillLabel` on `TasteSignaturePayload`; version bump + lazy recompute |
| Fallback | Old rows without `pillLabel` → legacy `tasteArchetypeLabel(archetype)` until recompute |

## Problem

Patrons see a pill like **Genre-led** on profiles (e.g. `/profile/jdc`). That reads like internal analytics vocabulary, not taste identity. The headline already says *"Leans drama-heavy, with steady helpings of comedy and thriller"* — the pill should feel like the same world: **who you are as a viewer**, not how Sense classified you.

## Goals

1. **Identity** — Pill reads as a patron nickname (*Dramatist*), shareable and memorable.
2. **Genre-grounded** — Label derives from top TMDb genre tags in the diary (same signal as headlines).
3. **Pattern clarity** — Popover still explains purist / led / dual / eclectic behavior in plain language with genre names.
4. **Stability** — Same diary → same `pillLabel` (hash-stable picks for eclectic pool).
5. **Parity** — Own profile and visitor profile use the same `pillLabel`; popover copy respects self vs visitor perspective.

## Non-goals

- LLM-generated personas.
- Changing archetype detection thresholds or headline templates in this pass.
- New API routes.
- Taste compare / OG layout redesign (OG may show `pillLabel` later if desired — optional follow-up).
- TV-specific genre personas beyond existing TMDb TV genre ids in the lexicon.

---

## Pill label rules

| Internal archetype | `pillLabel` pattern | Example |
|--------------------|---------------------|---------|
| `genre-purist` | `{primaryPersona}` | Dramatist |
| `genre-led` | `{primaryPersona}` | Dramatist |
| `dual-affinity` | `{primaryPersona} & {secondaryPersona}` | Dramatist & Comedian |
| `eclectic` | Pick from eclectic pool (stable hash) | Omnivore |
| `forming`, `curator`, legacy scoring archetypes | No pill | — |

**Length:** Target ≤ 28 characters on pill. If duo exceeds limit, use shorter secondary persona alias from lexicon (`shortPersona` field) or drop secondary to primary-only with full duo named in popover only — prefer shortening aliases first.

**Casing:** Title case for pill display (*Dramatist & Comedian*).

---

## Genre persona lexicon (v1)

Maps TMDb movie genre id → `{ persona, shortPersona?, popoverGenreName? }`. `persona` is the pill word; `shortPersona` optional for duo truncation; `popoverGenreName` defaults to existing lowercase genre label from `genreLabel()` when omitted.

| TMDb id | Genre | Persona | Short (duo) |
|---------|-------|---------|-------------|
| 18 | drama | Dramatist | — |
| 35 | comedy | Comedian | Comic |
| 27 | horror | Nightwatcher | — |
| 53 | thriller | Thrill-seeker | Thriller |
| 878 | science fiction | Futurist | Sci-fi |
| 10749 | romance | Romantic | — |
| 16 | animation | Toonist | — |
| 99 | documentary | Documentarian | Docs |
| 14 | fantasy | Fantasist | — |
| 9648 | mystery | Sleuth | — |
| 80 | crime | Noirist | — |
| 28 | action | Adrenalist | Action |
| 12 | adventure | Adventurer | — |
| 37 | western | Westerner | — |
| 36 | history | Historian | — |
| 10402 | music | Melophile | — |
| 10751 | family | Storykeeper | Family |
| 10752 | war | Chronicler | — |
| 10759 | action & adventure | Adventurer | — |
| 10765 | sci-fi & fantasy | Futurist | — |
| 10762 | kids | Storykeeper | Kids |
| 10764 | reality | Voyeur | — |
| 10766 | soap | Serialist | — |
| 10767 | talk | Conversationalist | Talk |
| 10768 | war & politics | Chronicler | — |
| 10763 | news | Chronicler | News |
| 10770 | TV movie | Cinephile | — |

**Unknown genre id:** Fallback persona **Cinephile**; popover uses raw genre name if available.

### Eclectic pool (stable pick)

When archetype is `eclectic`, choose one label via existing `stableTemplateIndex` hash over:

1. **Omnivore**
2. **Restless viewer**
3. **Wide canvas**
4. **Genre rover**

---

## Popover copy (title + body)

- **Popover title** = `pillLabel` (not legacy archetype name).
- **Popover body** = pattern explainer (self vs visitor) + newline + genre detail line listing top 2–3 genres by name.

| Archetype | Self body (pattern) | Visitor body (pattern) |
|-----------|---------------------|-------------------------|
| `genre-purist` | Most of your diary lives in {primaryGenre}. Sense reads genre tags from your logs. | Most of their diary lives in {primaryGenre}. Sense reads genre tags from their logs. |
| `genre-led` | {primaryGenre} leads, with {secondaryGenre} and {tertiaryGenre} in steady rotation. A favorite lane, not a single-genre diary. | {primaryGenre} leads, with {secondaryGenre} and {tertiaryGenre} in steady rotation. A favorite lane, not a single-genre diary. |
| `dual-affinity` | {primaryGenre} and {secondaryGenre} show up together more than any other pairing. That duo defines your watch history. | {primaryGenre} and {secondaryGenre} show up together more than any other pairing. That duo defines their watch history. |
| `eclectic` | You spread attention across many genres — no single lane. A wide-ranging diary. | They spread attention across many genres — no single lane. A wide-ranging diary. |

Genre names in body use display labels (*Drama*, *Comedy*) — capitalize first letter of `genreLabel()` output for popover prose.

---

## Data model & versioning

Extend `TasteSignaturePayload` / `TasteSignatureJson`:

```ts
pillLabel?: string; // e.g. "Dramatist & Comedian"
```

- Bump `TASTE_SIGNATURE_VERSION` from **3 → 4**.
- `computeTasteSignatureFromLogs` sets `pillLabel` via `buildTastePillLabel(archetype, stats)`.
- Lazy recompute on profile load when `version < 4` (existing path in `recompute-user-taste-signature.ts`).
- Keep `archetype` field for analytics and headline template selection — internal only in patron UI except debug/staff.

---

## Implementation touchpoints

| Area | File(s) |
|------|---------|
| Lexicon + builder | `apps/server/src/lib/sense-taste-signature.ts` (or `taste-persona-lexicon.ts` imported there) |
| Payload + version | `sense-taste-signature.ts` server |
| Web types + pill resolver | `apps/web/src/lib/sense-taste-signature.ts` — `tasteSignaturePillLabel()`, update `tasteArchetypeDescription()` to accept stats or genre names |
| UI | `apps/web/src/components/profile/profile-taste-signature.tsx` — use `pillLabel` for trigger + popover title |
| Tests | `sense-taste-signature.test.ts` server + web |

---

## Testing

**Server unit tests:**

- Purist drama diary → `pillLabel === "Dramatist"`.
- Dual drama + animation → `pillLabel === "Dramatist & Toonist"`.
- Eclectic spread → one of eclectic pool; stable across repeated compute with same inputs.
- Unknown genre id → `Cinephile`.
- Duo length > 28 → short alias used when defined.

**Web unit tests:**

- `tasteSignaturePillLabel` prefers `pillLabel` from JSON; falls back to legacy archetype label.
- Popover description includes genre display names for led case.

**Manual QA:**

- `/profile/[handle]` with genre-led taste → pill shows persona, popover explains rotation with genre names.
- Own profile vs visitor — popover second person vs third person.
- Patron with `< 10` logs / low confidence — no pill.

---

## Rollout

1. Ship server + web with version 4 compute.
2. Existing profiles recompute on next visit (no migration SQL).
3. Optional: one-time batch recompute script — **not required** for launch.

---

## Spec self-review (2026-07-06)

- [x] No TBD sections — lexicon and rules complete for v1.
- [x] Consistent with current archetype classifier (`genre-purist`, `genre-led`, `dual-affinity`, `eclectic` only for pills).
- [x] Scope bounded to pill + popover; headlines unchanged.
- [x] Ambiguity resolved: purist vs led share pill rule; distinction in popover/headline only.
- [x] No secrets or env vars.
