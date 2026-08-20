# Onboarding data import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After full-setup favorites, ask patrons to import from Letterboxd and/or Anilist (existing APIs) before Done, with IMDb/Trakt/Serializd shown as Soon.

**Architecture:** Add wizard steps `import` (source pills, right pane) and `import-upload` (shared Settings upload panel). A pure queue helper orders Letterboxd then Anilist. Settings wrappers stay thin around extracted panels. `finishFull` still runs on Complete setup, then navigates to `import` instead of `done`.

**Tech Stack:** Next.js App Router, React client wizard, `bun:test`, existing `POST /api/import/letterboxd` and `POST /api/import/anilist`, `motion/react` via `OnboardingStepShell` (do not add `.t-page-slide` here).

**Spec:** `docs/superpowers/specs/2026-08-13-onboarding-import-design.md`

## Global Constraints

- Patron-facing product name is Sense; copy uses Letterboxd / Anilist / IMDb / Trakt / Serializd (no TV Time).
- Surfaces: `bg-card` shell, `bg-background` pills, no borders/rings/shadows on source rows.
- Live sources are checkboxes (multi-select). Soon rows are focusable `aria-disabled`, not native `disabled`.
- Continue on the picker requires ≥1 live source. Skip is **Not now** (picker) or **Skip for now** (upload), never Continue-with-zero.
- Abbreviated Maybe later path must not visit `import` / `import-upload`.
- Reuse existing import APIs and toasts; do not add backends.
- Picker ↔ upload uses existing `OnboardingStepShell` 200ms slide; honor `useReducedMotion`.
- Imports at top of files only (no inline imports).
- Wizard `switch` over `WizardStep` must remain exhaustive (`never` in default) wherever that pattern already exists.
- Do **not** commit unless the user explicitly asks. Skip every Commit step below until then.
- After modifying code files, run `graphify update .` once at the end of the last code task (AST-only).

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/onboarding-types.ts` | Add `"import" \| "import-upload"` to `WizardStep` |
| `apps/web/src/lib/onboarding-import-queue.ts` | Live/soon catalogs, queue builder, toggle helper |
| `apps/web/src/lib/onboarding-import-queue.test.ts` | Queue + toggle tests |
| `apps/web/src/lib/onboarding-step-graph.ts` | `previousOnboardingStep` extracted from the wizard |
| `apps/web/src/lib/onboarding-step-graph.test.ts` | Back/forward graph including import |
| `apps/web/src/components/profile/letterboxd-import-panel.tsx` | Shared Letterboxd dropzone + fetch |
| `apps/web/src/components/profile/me-letterboxd-import.tsx` | Settings chrome wrapper |
| `apps/web/src/components/profile/anilist-import-panel.tsx` | Shared Anilist dropzone + fetch |
| `apps/web/src/components/profile/me-anilist-import.tsx` | Settings chrome wrapper |
| `apps/web/src/components/onboarding/onboarding-import-source-list.tsx` | Right-pane (and mobile) source pills |
| `apps/web/src/components/onboarding/onboarding-steps/import-step.tsx` | Picker copy + stacked actions |
| `apps/web/src/components/onboarding/onboarding-steps/import-upload-step.tsx` | Upload copy + stacked actions |
| `apps/web/src/components/onboarding/onboarding-wizard.tsx` | Wire steps, state, layout swap |
| `apps/web/src/components/onboarding/onboarding-preview-panel.tsx` | Hide profile on import steps |

---

### Task 1: Import queue helper

**Files:**
- Create: `apps/web/src/lib/onboarding-import-queue.ts`
- Test: `apps/web/src/lib/onboarding-import-queue.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:

```ts
export const ONBOARDING_IMPORT_LIVE_SOURCES = ["letterboxd", "anilist"] as const;
export const ONBOARDING_IMPORT_SOON_SOURCES = ["imdb", "trakt", "serializd"] as const;
export type OnboardingImportLiveSource =
	(typeof ONBOARDING_IMPORT_LIVE_SOURCES)[number];
export type OnboardingImportSoonSource =
	(typeof ONBOARDING_IMPORT_SOON_SOURCES)[number];
export type OnboardingImportSourceId =
	| OnboardingImportLiveSource
	| OnboardingImportSoonSource;

export const ONBOARDING_IMPORT_SOURCE_LABEL: Record<
	OnboardingImportSourceId,
	string
> = {
	letterboxd: "Letterboxd",
	anilist: "Anilist",
	imdb: "IMDb",
	trakt: "Trakt",
	serializd: "Serializd",
};

export function isOnboardingImportLiveSource(
	id: string,
): id is OnboardingImportLiveSource;

export function buildOnboardingImportQueue(
	selected: Iterable<string>,
): OnboardingImportLiveSource[];

export function toggleOnboardingImportLiveSource(
	selected: ReadonlySet<OnboardingImportLiveSource>,
	id: OnboardingImportLiveSource,
): Set<OnboardingImportLiveSource>;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/onboarding-import-queue.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	buildOnboardingImportQueue,
	toggleOnboardingImportLiveSource,
} from "./onboarding-import-queue";

describe("buildOnboardingImportQueue", () => {
	test("empty selection yields an empty queue", () => {
		expect(buildOnboardingImportQueue([])).toEqual([]);
	});

	test("letterboxd only", () => {
		expect(buildOnboardingImportQueue(["letterboxd"])).toEqual(["letterboxd"]);
	});

	test("anilist only", () => {
		expect(buildOnboardingImportQueue(["anilist"])).toEqual(["anilist"]);
	});

	test("both live sources always order Letterboxd then Anilist", () => {
		expect(buildOnboardingImportQueue(["anilist", "letterboxd"])).toEqual([
			"letterboxd",
			"anilist",
		]);
		expect(buildOnboardingImportQueue(["letterboxd", "anilist"])).toEqual([
			"letterboxd",
			"anilist",
		]);
	});

	test("ignores soon ids and unknown strings", () => {
		expect(
			buildOnboardingImportQueue(["imdb", "trakt", "serializd", "tvtime"]),
		).toEqual([]);
		expect(buildOnboardingImportQueue(["letterboxd", "imdb"])).toEqual([
			"letterboxd",
		]);
	});

	test("dedupes repeats", () => {
		expect(
			buildOnboardingImportQueue(["letterboxd", "letterboxd", "anilist"]),
		).toEqual(["letterboxd", "anilist"]);
	});
});

describe("toggleOnboardingImportLiveSource", () => {
	test("adds then removes", () => {
		const added = toggleOnboardingImportLiveSource(new Set(), "letterboxd");
		expect([...added]).toEqual(["letterboxd"]);
		expect([
			...toggleOnboardingImportLiveSource(added, "letterboxd"),
		]).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/onboarding-import-queue.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/onboarding-import-queue.ts` with the exports above.

```ts
export const ONBOARDING_IMPORT_LIVE_SOURCES = ["letterboxd", "anilist"] as const;
export const ONBOARDING_IMPORT_SOON_SOURCES = ["imdb", "trakt", "serializd"] as const;

const LIVE_ORDER = ONBOARDING_IMPORT_LIVE_SOURCES;

export function isOnboardingImportLiveSource(
	id: string,
): id is OnboardingImportLiveSource {
	return (LIVE_ORDER as readonly string[]).includes(id);
}

export function buildOnboardingImportQueue(
	selected: Iterable<string>,
): OnboardingImportLiveSource[] {
	const picked = new Set<OnboardingImportLiveSource>();
	for (const id of selected) {
		if (isOnboardingImportLiveSource(id)) picked.add(id);
	}
	return LIVE_ORDER.filter((id) => picked.has(id));
}

export function toggleOnboardingImportLiveSource(
	selected: ReadonlySet<OnboardingImportLiveSource>,
	id: OnboardingImportLiveSource,
): Set<OnboardingImportLiveSource> {
	const next = new Set(selected);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	return next;
}
```

Include `ONBOARDING_IMPORT_SOURCE_LABEL` as specified in Interfaces.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/onboarding-import-queue.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** — skip unless the user asked to commit.

---

### Task 2: Step graph + WizardStep types

**Files:**
- Modify: `apps/web/src/lib/onboarding-types.ts`
- Create: `apps/web/src/lib/onboarding-step-graph.ts`
- Test: `apps/web/src/lib/onboarding-step-graph.test.ts`
- Modify: `apps/web/src/components/onboarding/onboarding-wizard.tsx` (replace local `previousStep` with the extracted function)

**Interfaces:**
- Consumes: `WizardStep`, `WizardSkipMode` from `onboarding-types.ts`
- Produces:

```ts
export function previousOnboardingStep(
	current: WizardStep,
	skipMode: WizardSkipMode,
): WizardStep | null;

export function isOnboardingImportStep(step: WizardStep): boolean;
```

- [ ] **Step 1: Extend `WizardStep`**

In `apps/web/src/lib/onboarding-types.ts`, change:

```ts
export type WizardStep =
	| "welcome"
	| "avatar"
	| "name"
	| "handle"
	| "bio"
	| "verify"
	| "taste"
	| "favorites"
	| "import"
	| "import-upload"
	| "done";
```

- [ ] **Step 2: Write the failing graph test**

Create `apps/web/src/lib/onboarding-step-graph.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { isOnboardingImportStep, previousOnboardingStep } from "./onboarding-step-graph";

describe("previousOnboardingStep", () => {
	test("full path: import back is favorites, upload back is import", () => {
		expect(previousOnboardingStep("import", "full")).toBe("favorites");
		expect(previousOnboardingStep("import-upload", "full")).toBe("import");
		expect(previousOnboardingStep("favorites", "full")).toBe("taste");
	});

	test("abbreviated path never returns import steps", () => {
		expect(previousOnboardingStep("handle", "abbreviated")).toBe("name");
		expect(previousOnboardingStep("import", "abbreviated")).toBe(null);
		expect(previousOnboardingStep("import-upload", "abbreviated")).toBe(null);
	});

	test("done / welcome / verify have no back", () => {
		expect(previousOnboardingStep("done", "full")).toBe(null);
		expect(previousOnboardingStep("welcome", "full")).toBe(null);
		expect(previousOnboardingStep("verify", "full")).toBe(null);
	});
});

describe("isOnboardingImportStep", () => {
	test("only the two import steps", () => {
		expect(isOnboardingImportStep("import")).toBe(true);
		expect(isOnboardingImportStep("import-upload")).toBe(true);
		expect(isOnboardingImportStep("done")).toBe(false);
		expect(isOnboardingImportStep("favorites")).toBe(false);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/onboarding-step-graph.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 4: Implement graph**

Create `apps/web/src/lib/onboarding-step-graph.ts`. Move the wizard’s `previousStep` body here as `previousOnboardingStep`, and add:

```ts
if (current === "import") return "favorites";
if (current === "import-upload") return "import";
```

before the final `return null` of the full-path branch (not inside abbreviated).

```ts
export function isOnboardingImportStep(step: WizardStep): boolean {
	return step === "import" || step === "import-upload";
}
```

Keep the exhaustive `never` unused if the function uses early returns; do not drop existing branches (`avatar` → `welcome`, `taste` → `bio`, etc.).

- [ ] **Step 5: Point the wizard at the extracted function**

In `onboarding-wizard.tsx`:
- Delete local `previousStep`.
- Import `previousOnboardingStep` from `@/lib/onboarding-step-graph`.
- Call `previousOnboardingStep(step, skipMode)` in `handleBack` / `showBack`.

Fix `previewMotionForStep` later (Task 7) if TypeScript now requires new `WizardStep` cases. If `check-types` fails on `onboarding-preview-panel.tsx` or the wizard `stepContent` switch after Step 1, add `case "import":` / `case "import-upload":` stubs that `return null` until Task 5–7 (wizard exhaustive switch **must** compile).

- [ ] **Step 6: Run tests**

Run: `cd apps/web && bun test src/lib/onboarding-step-graph.test.ts src/lib/onboarding-import-queue.test.ts`

Expected: PASS

- [ ] **Step 7: Commit** — skip unless asked.

---

### Task 3: Extract Letterboxd import panel

**Files:**
- Create: `apps/web/src/components/profile/letterboxd-import-panel.tsx`
- Modify: `apps/web/src/components/profile/me-letterboxd-import.tsx`

**Interfaces:**
- Consumes: existing fetch to `/api/import/letterboxd`, `stillApiOrigin()`, current helpers in `me-letterboxd-import.tsx`
- Produces:

```ts
export type ImportPanelRunner = {
	canImport: boolean;
	isImporting: boolean;
	runImport: () => Promise<boolean>;
};

export type LetterboxdImportPanelProps = {
	variant: "settings" | "onboarding";
	onImported?: () => void;
	onRunnerChange?: (runner: ImportPanelRunner) => void;
};

export function LetterboxdImportPanel(props: LetterboxdImportPanelProps): JSX.Element;
```

`runImport` returns `true` only after a successful `res.ok` (same toast behavior as today). Call `onImported` after success, before clearing files.

- [ ] **Step 1: Move the current `MeLetterboxdImport` implementation** into `letterboxd-import-panel.tsx` as `LetterboxdImportPanel`.
  - Move all helpers currently in `me-letterboxd-import.tsx` (`LETTERBOXD_*`, `mergePickedFiles`, `formatImportToast`, types) with the panel so Settings behavior is unchanged.
  - Keep copying `FileList` synchronously before clearing the input.
  - `variant === "settings"`: keep `MeSettingsSection` + how-to ol + inner **Import into Sense** button (current UI).
  - `variant === "onboarding"`: render only the file checklist + dropzone + selected chips + missing-file hint + result block. **Do not** render `MeSettingsSection`, the 3-step how-to, or the inner Import/Clear buttons (parent owns Import).
  - `useEffect` that calls `onRunnerChange?.({ canImport, isImporting, runImport })` whenever those values change.
  - Change `runImport` to `Promise<boolean>` (`true` on success, `false` on validation/network/API error).

- [ ] **Step 2: Settings wrapper**

`me-letterboxd-import.tsx` becomes:

```tsx
"use client";

import { LetterboxdImportPanel } from "@/components/profile/letterboxd-import-panel";

/** Settings → Data Letterboxd importer (chrome lives in the panel settings variant). */
export function MeLetterboxdImport() {
	return <LetterboxdImportPanel variant="settings" />;
}
```

- [ ] **Step 3: Verify Settings still typechecks**

`settings-section-panels.tsx` keeps importing `MeLetterboxdImport` — no change required there.

Run from repo root: `cd apps/web && bunx tsc --noEmit --pretty false` is heavy; prefer the existing package check if it is fast enough, otherwise rely on the editor. At minimum, confirm `MeLetterboxdImport` still exports.

- [ ] **Step 4: Commit** — skip unless asked.

---

### Task 4: Extract Anilist import panel

**Files:**
- Create: `apps/web/src/components/profile/anilist-import-panel.tsx`
- Modify: `apps/web/src/components/profile/me-anilist-import.tsx`

**Interfaces:**
- Consumes: existing `/api/import/anilist` fetch
- Produces: same `ImportPanelRunner` shape (import the type from `letterboxd-import-panel.tsx` **or** extract `import-panel-runner.ts` if that avoids a weird Anilist→Letterboxd import). Prefer a tiny shared type file:

Create `apps/web/src/components/profile/import-panel-runner.ts`:

```ts
export type ImportPanelRunner = {
	canImport: boolean;
	isImporting: boolean;
	runImport: () => Promise<boolean>;
};
```

Re-export or switch Letterboxd to import from here (do this in this task if Task 3 inlined the type).

```ts
export type AnilistImportPanelProps = {
	variant: "settings" | "onboarding";
	onImported?: () => void;
	onRunnerChange?: (runner: ImportPanelRunner) => void;
};

export function AnilistImportPanel(props: AnilistImportPanelProps): JSX.Element;
```

- [ ] **Step 1: Move `MeAnilistImport` body** into `AnilistImportPanel` with the same variant split as Letterboxd (settings = full chrome + **Import into Sense**; onboarding = dropzone + result only).
- [ ] **Step 2: Wrapper**

```tsx
"use client";

import { AnilistImportPanel } from "@/components/profile/anilist-import-panel";

export function MeAnilistImport() {
	return <AnilistImportPanel variant="settings" />;
}
```

- [ ] **Step 3: Commit** — skip unless asked.

---

### Task 5: Source list + picker step

**Files:**
- Create: `apps/web/src/components/onboarding/onboarding-import-source-list.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/import-step.tsx`

**Interfaces:**
- Consumes: queue catalogs + `toggleOnboardingImportLiveSource`, `OnboardingPrimaryButton` / `OnboardingSecondaryButton`, `OnboardingStepHeader`
- Produces:

```tsx
export function OnboardingImportSourceList(props: {
	selected: ReadonlySet<OnboardingImportLiveSource>;
	onToggleLive: (id: OnboardingImportLiveSource) => void;
	className?: string;
}): JSX.Element;

export function ImportStep(props: {
	onBack: () => void;
	onContinue: () => void;
	onNotNow: () => void;
	continueDisabled: boolean;
}): JSX.Element;
```

The source list is **not** inside `ImportStep` on desktop — the wizard puts it in the right pane (Task 7). `ImportStep` is left-column copy + stacked actions only. On mobile, Task 7 also renders `OnboardingImportSourceList` under the step (same pattern as `TasteStepGridPanel mobileInline`).

- [ ] **Step 1: Source list**

Pills for `ONBOARDING_IMPORT_LIVE_SOURCES` then `ONBOARDING_IMPORT_SOON_SOURCES`.

Live row: `<button type="button" role="checkbox" aria-checked={selected}>` with `aria-label={label}` (product name). Space/Enter toggles via `onClick`. Leading monogram (`label[0]`, `aria-hidden`). Trailing circle; selected = `bg-foreground` + lucide `Check` (`aria-hidden`). Classes: `flex w-full items-center gap-3 rounded-2xl bg-background px-4 py-3.5 text-left`. Selected live can stay `bg-background` (already raised vs `bg-card` parent) — do not add a ring.

Soon row: `<button type="button" aria-disabled="true" aria-label={`${label}, soon`}>`. `onClick` / `onKeyDown` prevent toggle. Visible **Soon** text. Muted opacity. Still in tab order.

Wrap the stack in:

```tsx
<div role="group" aria-label="Import sources" className="flex flex-col gap-3">
```

- [ ] **Step 2: ImportStep**

```tsx
"use client";

import {
	OnboardingPrimaryButton,
	OnboardingSecondaryButton,
} from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";

type ImportStepProps = {
	onBack: () => void;
	onContinue: () => void;
	onNotNow: () => void;
	continueDisabled: boolean;
};

/** Post-setup source picker — left copy + stacked actions (list lives in the right pane). */
export function ImportStep({
	onBack,
	onContinue,
	onNotNow,
	continueDisabled,
}: ImportStepProps) {
	return (
		<div className="flex flex-col gap-8">
			<OnboardingStepHeader
				title="Bring your diary with you"
				description="Import from Letterboxd or Anilist. You can skip this."
			/>
			<div className="flex flex-col gap-3">
				<OnboardingSecondaryButton className="w-full" onClick={onBack}>
					Back
				</OnboardingSecondaryButton>
				<OnboardingPrimaryButton
					className="w-full"
					disabled={continueDisabled}
					onClick={onContinue}
				>
					Continue
				</OnboardingPrimaryButton>
				<button
					className="mx-auto cursor-pointer bg-transparent px-3 py-2 font-medium text-muted-foreground text-sm select-none [@media(hover:hover)]:hover:text-foreground"
					onClick={onNotNow}
					type="button"
				>
					Not now
				</button>
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Commit** — skip unless asked.

---

### Task 6: Upload step

**Files:**
- Create: `apps/web/src/components/onboarding/onboarding-steps/import-upload-step.tsx`

**Interfaces:**
- Consumes: `OnboardingImportLiveSource`, `ImportPanelRunner`
- Produces:

```tsx
export function ImportUploadStep(props: {
	source: OnboardingImportLiveSource;
	importDisabled: boolean;
	isImporting: boolean;
	onBack: () => void;
	onImport: () => void;
	onSkip: () => void;
}): JSX.Element;
```

Copy:

| `source` | title | description |
|----------|-------|-------------|
| `letterboxd` | Import from Letterboxd | Upload the CSV files from your Letterboxd export folder. |
| `anilist` | Import from Anilist | Upload your Anilist list JSON export. |

Use an exhaustive switch with `never` default.

Stacked actions: Back (secondary), Import (primary, `disabled={importDisabled}`), Skip for now (quiet, same class as Not now). Label stays **Import** while busy (disable the button; do not change the label to “OK”).

The actual `LetterboxdImportPanel` / `AnilistImportPanel` is rendered by the wizard in the right pane (and mobile under the step), not inside this component.

- [ ] **Step 1: Implement `ImportUploadStep`** as specified.
- [ ] **Step 2: Commit** — skip unless asked.

---

### Task 7: Wire the wizard

**Files:**
- Modify: `apps/web/src/components/onboarding/onboarding-wizard.tsx`
- Modify: `apps/web/src/components/onboarding/onboarding-preview-panel.tsx`

**Interfaces:**
- Consumes: Tasks 1–6
- Produces: working `/onboarding` flow

- [ ] **Step 1: State**

```ts
const [selectedImportSources, setSelectedImportSources] = useState<
	Set<OnboardingImportLiveSource>
>(() => new Set());
const [importQueue, setImportQueue] = useState<OnboardingImportLiveSource[]>(
	[],
);
const [importQueueIndex, setImportQueueIndex] = useState(0);
const [importRunner, setImportRunner] = useState<ImportPanelRunner | null>(
	null,
);
```

- [ ] **Step 2: `finishFull` destination**

Replace `goTo("done", 1)` with `goTo("import", 1)` after a successful save. Keep the “Profile saved” toast.

- [ ] **Step 3: Continue / skip / import handlers**

On picker Continue:

```ts
const queue = buildOnboardingImportQueue(selectedImportSources);
if (queue.length === 0) return;
setImportQueue(queue);
setImportQueueIndex(0);
setImportRunner(null);
goTo("import-upload", 1);
```

`continueDisabled` for `import`: `selectedImportSources.size === 0` (also keep `isSaving`).

Not now / Skip for now: `goTo("done", 1)`.

After successful `runImport()`:

```ts
const nextIndex = importQueueIndex + 1;
if (nextIndex < importQueue.length) {
	setImportQueueIndex(nextIndex);
	setImportRunner(null);
	return;
}
goTo("done", 1);
```

Do not change `stepKey` away from `"import-upload"` when advancing Letterboxd → Anilist (same step, different source). Force a remount with `key={importQueue[importQueueIndex]}` on the panel.

- [ ] **Step 4: `showNav`**

```ts
const showNav =
	step !== "welcome" &&
	step !== "verify" &&
	step !== "done" &&
	!isOnboardingImportStep(step);
```

Import steps use in-step stacked actions only.

- [ ] **Step 5: `stepContent` cases**

Add `import` and `import-upload` before `default` / `never`.

`import`: `<ImportStep … />` plus mobile list:

```tsx
<div className="mt-6 w-full lg:hidden">
	<OnboardingImportSourceList
		selected={selectedImportSources}
		onToggleLive={(id) =>
			setSelectedImportSources((current) =>
				toggleOnboardingImportLiveSource(current, id),
			)
		}
	/>
</div>
```

`import-upload`: `<ImportUploadStep source={importQueue[importQueueIndex]!} … />` plus mobile panel (`lg:hidden`). Guard: if `importQueue[importQueueIndex]` is missing, `goTo("done")` / render null.

- [ ] **Step 6: Right pane**

Extend the existing taste/favorites preview swap:

- `step === "import"` → desktop `OnboardingImportSourceList`
- `step === "import-upload"` → `LetterboxdImportPanel` or `AnilistImportPanel` with `variant="onboarding"`, `onRunnerChange={setImportRunner}`, `onImported` advancing the queue (same logic as successful Import click — prefer **one** `advanceImportQueue` callback used by both the button and `onImported` so a panel that auto-toasts does not double-advance: **Import button calls `runner.runImport()`; `onImported` is the single advance**. Do not also advance inside `runImport` success in the parent.)

Parent Import click:

```ts
const ok = await importRunner?.runImport();
// advance happens in onImported when ok
```

`previewClassName` stretch for import steps (same as taste/favorites).

- [ ] **Step 7: Preview panel**

In `OnboardingPreviewPanel`, return `null` when `isOnboardingImportStep(step)` (same early return as taste/favorites around line 232).

`IDENTITY_STRIP_STEPS` stays identity-only (import already excluded).

If `previewMotionForStep` is a `switch` that TypeScript flags as non-exhaustive, add `case "import"` / `case "import-upload"` returning `{ y: 0, scale: 1 }` (unused when the panel is hidden).

If the wizard `stepContent` `switch` is missing the new cases, it will fail `never` — add them in Step 5.

- [ ] **Step 8: Smoke tests**

Run: `cd apps/web && bun test src/lib/onboarding-import-queue.test.ts src/lib/onboarding-step-graph.test.ts`

Expected: PASS

- [ ] **Step 9: Commit** — skip unless asked.

---

### Task 8: Human QA

**Files:** none (manual)

- [ ] Full setup → picker shows Letterboxd, Anilist, then IMDb / Trakt / Serializd as Soon. Continue disabled until a live check.
- [ ] Not now → You made it → Enter Sense. Settings → Data still has both importers.
- [ ] Letterboxd only → upload recognized CSVs → Done. Diary appears after `/home`.
- [ ] Both checked → Letterboxd upload → Anilist upload → Done.
- [ ] Bad Letterboxd file → stay on upload; Skip for now → Done.
- [ ] Soon row is keyboard-focusable, does not select, Continue stays disabled if only Soon was “pressed”.
- [ ] Maybe later abbreviated: name + handle → `/home`, no import step.
- [ ] `prefers-reduced-motion`: no step slide.
- [ ] Narrow viewport: list/dropzone then actions; Continue not clipped.
- [ ] Refresh after Complete setup: `/home` (import not resumed).
- [ ] Run `graphify update .` from the repo root.

---

## Self-review

**Spec coverage**

| Spec section | Task |
|--------------|------|
| Flow after favorites / Not now / queue | 2, 7 |
| Multi-select both live, Letterboxd then Anilist | 1, 7 |
| Soon rows IMDb/Trakt/Serializd, no TV Time | 1, 5 |
| In-wizard upload, shared APIs | 3, 4, 6, 7 |
| Split layout + stacked actions | 5, 6, 7 |
| Abbreviated skip | 2, 7 |
| Finish timing / no resume | 7 (`goTo("import")` after `finishFull`) |
| a11y checkbox / Soon focusable | 5 |
| Motion = existing shell | 7 (no `.t-page-slide`) |
| Queue tests | 1 |
| Manual QA | 8 |

**Placeholder scan:** none remaining.

**Type consistency:** `OnboardingImportLiveSource`, `ImportPanelRunner`, `previousOnboardingStep`, `isOnboardingImportStep` used under those names throughout.
