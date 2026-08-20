# Sense — Onboarding data import

**Status:** Plan ready — see `docs/superpowers/plans/2026-08-13-onboarding-import.md` (2026-08-13)  
**Date:** 2026-08-13  
**Parent:** [2026-06-14-onboarding-wizard-design.md](./2026-06-14-onboarding-wizard-design.md)  
**Approach:** **1 — New wizard steps** `import` + `import-upload` after full-setup favorites  
**Reference:** Split-pane source picker (copy + stacked actions left; selectable source pills right)

## Summary

After a patron finishes identity + taste + favorites, ask whether to import an existing diary before **You made it**. Live sources are **Letterboxd** and **Anilist** (existing Settings → Data engines). **IMDb**, **Trakt**, and **Serializd** appear as disabled **Soon** rows. Upload happens in the wizard. Skip is always available. Abbreviated **Maybe later** never sees this step.

**North star:** Switching to Sense should feel like bringing your history with you — without blocking first `/home` if they have nothing to import.

## Brainstorm decisions (locked)

| Topic | Decision |
|-------|----------|
| Live sources | Letterboxd + Anilist |
| Extra rows | IMDb · Trakt · Serializd as **Soon** (not selectable). No TV Time. |
| Where upload happens | **A** — in-wizard after the picker |
| How many sources | One **or both** live sources. Multi-select. If both, sequential uploads: Letterboxd then Anilist. |
| Who sees it | **A** — full setup only (after favorites). Abbreviated path skips import. |
| Implementation | **1** — new steps `import` + `import-upload`; reuse Settings upload engines |

## Goals

1. Offer import immediately after account setup, before the Done celebration.
2. Reuse `POST /api/import/letterboxd` and `POST /api/import/anilist` — no new backends.
3. Match the reference split: copy + actions on the left, source pills on the right (`lg+`).
4. Let patrons skip without shame; never require a file.
5. Keep coming-soon sources visible so the picker looks like a switcher, without teasing TV Time (service shut down 15 Jul 2026).

## Non-goals (v1)

- Building IMDb / Trakt / Serializd / TV Time importers.
- Import on the abbreviated **Maybe later** path.
- Multi-import round-trips back to the picker after the first upload (queue is chosen once).
- Changing Settings → Data beyond extracting a shared upload panel.
- ZIP Letterboxd upload (still out of scope; same as Settings).
- Resuming the import step after a full page reload (see [Finish timing](#3-finish-timing--resume)).

---

## 1. Flow

```
favorites → finishFull (existing) → import picker
                                    ├─ Not now → done
                                    ├─ 1 live source → import-upload → done
                                    └─ both live → Letterboxd upload → Anilist upload → done
```

Abbreviated: `welcome → name → handle → /home` (unchanged).

**Picker Continue** requires ≥1 live source. **Not now** always goes to Done (same as zero selection, but Continue stays disabled until a live check so “Continue” never means skip).

**Upload Skip for now** drops the rest of the queue and goes to Done. A failed import stays on the upload step (toast already used in Settings). Success advances: next queued source, or Done.

**Back**

| From | To |
|------|-----|
| `import` | `favorites` (profile already saved — no undo) |
| `import-upload` | `import` (checks preserved; queue rebuilt on next Continue) |

---

## 2. Layout (reference → Sense tokens)

Do **not** copy the reference’s light-gray / white chrome. Map the structure onto the existing onboarding card (`bg-card` shell, `bg-background` controls, no borders/rings/shadows).

### Desktop (`lg+`)

Same shell as taste/favorites: wizard column left, right pane swapped.

| Pane | Picker (`import`) | Upload (`import-upload`) |
|------|-------------------|--------------------------|
| Left | Title + description + stacked actions | Title + short export hint + stacked actions |
| Right | Source pill list | Shared Letterboxd or Anilist upload panel |

Hide the live profile preview on both steps (same as taste). Hide the mobile preview strip too.

### Mobile

Copy, then the source list (or upload panel), then actions. Do not put Continue above the list — pick first, then act. Actions stay in normal flow (not a floating bar) with existing onboarding gutters.

### Source pills

Vertical stack of full-width rounded pills (`rounded-2xl`), generous gap (`gap-3`, ~12px between filled controls). Each live row is a **checkbox** (native or `role="checkbox"`) — not a radio — because two live sources can be on.

| State | Surface | Trailing control |
|-------|---------|------------------|
| Unselected live | `bg-background` on `bg-card` | Empty circle |
| Selected live | Raised `bg-background` (higher contrast fill, no ring) | Filled `bg-foreground` circle + check (reference Atlas state) |
| Soon | Same as unselected, `opacity` muted | No check; visible **Soon** text |

Do not use color alone for selected vs Soon. Selected has the check; Soon has the word **Soon**.

Leading slot: simple mark (letter monogram in a rounded tile is fine in v1 — no new brand-asset hunt). Name beside it, sentence-case product names: Letterboxd, Anilist, IMDb, Trakt, Serializd.

### Actions (picker)

Hide the shared horizontal wizard footer (`showNav` false, like Welcome). Stack full-width in the left column, matching the reference:

1. **Back** — `OnboardingSecondaryButton`
2. **Continue** — `OnboardingPrimaryButton`, disabled until ≥1 live source
3. **Not now** — quiet text button under the stack (skip to Done)

### Actions (upload)

Same stacked pattern:

1. **Back** — to picker
2. **Import** — disabled until files are valid (same gates as Settings)
3. **Skip for now** — drop remaining queue → Done

Disable **Import** while the request is in flight; keep the label **Import** (no “OK”). Spinner/busy via `disabled` + existing saving pattern.

---

## 3. Finish timing & resume

`finishFull` still runs on favorites **Complete setup** (`markOnboarded: true`), then `goTo("import")` instead of `goTo("done")`.

Consequence: a refresh on `/onboarding` after that save hits `patronNeedsOnboarding === false` and sends them to `/home`. That is acceptable. Import is best-effort; Settings → Data remains. Do **not** add a resume-to-import gate in v1.

---

## 4. Components & data

### Wizard types

Add to `WizardStep`: `"import" | "import-upload"`.

Wizard state:

- `selectedImportSources: Set<"letterboxd" | "anilist">`
- `importQueue: OnboardingImportSource[]` — built on Continue from the picker
- `importQueueIndex: number`

Soon ids (`imdb` | `trakt` | `serializd`) never enter the set or queue.

Pure helper (unit-tested):

```ts
buildOnboardingImportQueue(selected: Iterable<"letterboxd" | "anilist">): Array<"letterboxd" | "anilist">
```

Stable order: Letterboxd then Anilist, regardless of tap order.

### Shared upload panels

Extract the file UI + `fetch` from:

- `me-letterboxd-import.tsx` → `letterboxd-import-panel.tsx`
- `me-anilist-import.tsx` → `anilist-import-panel.tsx`

Settings pages wrap the same panels. Onboarding passes `variant="onboarding"` (no `MeSettingsSection` chrome) and `onImported` to advance the queue.

Keep existing copy of `FileList` before clearing the input (Letterboxd lesson).

### Copy (picker)

- Title: **Bring your diary with you**
- Description: **Import from Letterboxd or Anilist. You can skip this.**
- Continue / Back / Not now as above

### Copy (upload)

| Source | Title | Description |
|--------|-------|-------------|
| Letterboxd | Import from Letterboxd | Upload the CSV files from your Letterboxd export folder. |
| Anilist | Import from Anilist | Upload your Anilist list JSON export. |

Toasts stay the existing Settings strings (success counts, parse failures, rate limit). Do not invent a second voice.

### Accessibility

- Source list is a `group` (or `fieldset`) named **Import sources**.
- Live rows: checkbox (or toggle button) with accessible name = product name; `aria-checked` / native checked.
- Soon rows: **focusable**, `aria-disabled="true"`, name includes **Soon** (e.g. “IMDb, soon”). Do not use native `disabled` that drops them from the tab order, and do not put the only explanation in a tooltip.
- Keyboard: Tab through rows; Space/Enter toggles live rows; Soon rows announce unavailable and do not toggle.
- Icon marks are decorative (`aria-hidden`).
- Honor `useReducedMotion` via existing `OnboardingStepShell` (0ms slide).

### Motion

Picker ↔ upload uses the **existing** wizard step slide (`OnboardingStepShell`, 200ms, `prefers-reduced-motion` already wired). Do **not** also wrap these steps in transitions-dev `.t-page-slide` — that would double-slide.

`.t-page-*` tokens already live in `globals.css` for other surfaces; leave them alone for this feature.

Optional (only if a selected pill needs a moment): check icon can use the existing icon-swap / success-check vocabulary later. v1: instant check in the circle is enough (low-novelty toggle).

---

## 5. Error handling

| Case | Behavior |
|------|----------|
| Invalid / unrecognized files | Stay on upload; existing inline + toast |
| Network / 4xx / 5xx | Toast; stay on upload; Import re-enabled |
| Rate limit (3/hour) | Existing API error toast; stay on upload |
| Empty live selection | Continue disabled; Not now still works |
| Second source after first succeeds | Advance queue; do not rewind the first |
| User skips mid-queue | Done; no partial rollback of a successful first import |

No confirm dialog on Skip / Not now (nothing destructive is pending).

---

## 6. Testing

| File | Covers |
|------|--------|
| `onboarding-import-queue.test.ts` | Empty → `[]`; Letterboxd only; Anilist only; both → `[letterboxd, anilist]` regardless of insertion order; Soon ids ignored if accidentally passed |
| Wizard step graph (extend existing wizard tests if present, else a small `onboarding-import-steps.test.ts` for `previousStep` / continue routing) | `favorites` → `import`; `import` back → `favorites`; upload back → `import`; abbreviated path never returns `import` |

Do **not** re-test CSV/JSON parsers (already covered in `apps/server`).

**Manual QA**

1. Full setup → picker shows 2 live + 3 Soon. Continue disabled until a live check.
2. Not now → Done → Enter app. Settings → Data still has both importers.
3. Letterboxd only → upload CSVs → Done. Diary/watchlist appear after `/home`.
4. Both checked → Letterboxd upload → Anilist upload → Done.
5. Fail Letterboxd (bad file) → stay; Skip for now → Done.
6. Soon row: focusable, does not select, Continue still disabled if only Soon is “pressed”.
7. Abbreviated Maybe later: no import step.
8. Reduced motion: no step slide.
9. Narrow viewport: list then actions; Continue not clipped.
10. Refresh after Complete setup: `/home` (import not resumed).

---

## 7. Success criteria

- [ ] Full setup lands on the import picker after favorites save, not immediately on Done.
- [ ] Letterboxd and Anilist import in-wizard using the same APIs as Settings.
- [ ] Both sources can be queued; order is Letterboxd then Anilist.
- [ ] IMDb, Trakt, Serializd visible as Soon; not importable.
- [ ] Not now / Skip for now always reach Done.
- [ ] Abbreviated path unchanged.
- [ ] Split layout matches the reference structure on `lg+` using Sense surfaces.
- [ ] Queue helper tests pass.

---

## 8. Open follow-ups (post-v1)

- IMDb ratings/watchlist CSV importer.
- Trakt export zip/JSON importer (best TV+film next).
- Serializd export once a stable file format is documented.
- Optional TV Time GDPR rescue for patrons who still have a pre-shutdown zip.
- Resume import after reload (only if we delay `markOnboarded` until Done).
