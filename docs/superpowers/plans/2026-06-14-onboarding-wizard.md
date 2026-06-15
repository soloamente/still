# Animated Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sense onboarding v2 with a full identity wizard (animated step shell + live profile preview), email-verify gate before taste seeding, and quick-rate with Haven’t seen + search — while slimming sign-up to email + password only.

**Architecture:** Single client wizard on `/onboarding` split into focused step components. Pure taste/handle/finish logic lives in `apps/web/src/lib/onboarding-*.ts` with Bun tests first. Motion via `motion/react` + `react-use-measure`; profile preview is a lightweight read-only card. Server APIs unchanged except consuming existing `PATCH /profiles/me`, `POST /api/logs` (private visibility), avatar upload proxy.

**Tech Stack:** Next.js 16 App Router, `motion/react`, `react-use-measure`, `@still/ui`, Eden `api` client, Better Auth `authClient`, Bun test.

**Spec:** `docs/superpowers/specs/2026-06-14-onboarding-wizard-design.md`

---

## File structure

**apps/web**
- Modify: `apps/web/package.json` — add `react-use-measure`
- Modify: `apps/web/src/components/auth/sign-up-form.tsx` — email + password only
- Modify: `apps/web/src/app/onboarding/page.tsx` — pass session + emailVerified
- Delete: `apps/web/src/components/onboarding/onboarding-flow.tsx`
- Create: `apps/web/src/lib/onboarding-types.ts` — `WizardStep`, shared movie type
- Create: `apps/web/src/lib/onboarding-handle.ts` — `HANDLE_RE`, `validateHandle`, `normalizeHandleInput`
- Create: `apps/web/src/lib/onboarding-taste-state.ts` — rated count, skip, gate helpers
- Create: `apps/web/src/lib/onboarding-finish.ts` — `runOnboardingFinish` orchestration
- Create: `apps/web/src/lib/onboarding-taste-state.test.ts`
- Create: `apps/web/src/lib/onboarding-handle-validation.test.ts`
- Create: `apps/web/src/lib/onboarding-finish.test.ts`
- Create: `apps/web/src/components/onboarding/onboarding-wizard.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-step-shell.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-preview-panel.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-letter-reveal.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-wizard-layout.tsx` — full-bleed shell
- Create: `apps/web/src/components/onboarding/onboarding-steps/welcome-step.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/avatar-step.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/name-step.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/handle-step.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/bio-step.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/verify-email-step.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/taste-step.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/favorites-step.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-steps/done-step.tsx`

**docs**
- Modify: `docs/superpowers/specs/2026-06-14-onboarding-wizard-design.md` — set status to “Plan ready” when shipped

---

### Task 1: Dependencies + shared types

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/onboarding-types.ts`

- [ ] **Step 1.1: Add `react-use-measure`**

Run (from repo root):

```bash
cd apps/web && bun add react-use-measure
```

Expected: `react-use-measure` in `apps/web/package.json` dependencies.

- [ ] **Step 1.2: Create onboarding types**

Create `apps/web/src/lib/onboarding-types.ts`:

```ts
/** Wizard steps for Sense onboarding v3. */
export type WizardStep =
	| "welcome"
	| "avatar"
	| "name"
	| "handle"
	| "bio"
	| "verify"
	| "taste"
	| "favorites"
	| "done";

/** Abbreviated skip path after “Maybe later”. */
export type WizardSkipMode = "full" | "abbreviated";

export type OnboardingMovie = {
	id: number;
	title: string;
	poster_url: string | null;
};

export const ONBOARDING_TASTE_MIN_RATED = 8;
export const ONBOARDING_FAVORITES_MIN = 1;
export const ONBOARDING_BIO_MAX = 600;
```

- [ ] **Step 1.3: Install lockfile**

Run: `bun install` from repo root. Expected: exit 0.

---

### Task 2: Handle validation helpers (TDD)

**Files:**
- Create: `apps/web/src/lib/onboarding-handle.ts`
- Create: `apps/web/src/lib/onboarding-handle-validation.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `apps/web/src/lib/onboarding-handle-validation.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { normalizeHandleInput, validateHandle } from "./onboarding-handle";

describe("validateHandle", () => {
	test("accepts valid handles", () => {
		expect(validateHandle("anselmo")).toEqual({ ok: true });
		expect(validateHandle("a.b_2")).toEqual({ ok: true });
	});

	test("rejects too short", () => {
		expect(validateHandle("a")).toEqual({
			ok: false,
			reason: "format",
		});
	});

	test("rejects uppercase and spaces", () => {
		expect(validateHandle("Anselmo")).toEqual({
			ok: false,
			reason: "format",
		});
		expect(validateHandle("bad handle")).toEqual({
			ok: false,
			reason: "format",
		});
	});
});

describe("normalizeHandleInput", () => {
	test("lowercases and strips spaces", () => {
		expect(normalizeHandleInput("  Anselmo.Cinema  ")).toBe("anselmo.cinema");
	});
});
```

- [ ] **Step 2.2: Run tests — expect FAIL**

```bash
cd apps/web && bun test src/lib/onboarding-handle-validation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement handle helpers**

Create `apps/web/src/lib/onboarding-handle.ts`:

```ts
/** Mirror `apps/server/src/lib/handle-re.ts` for client validation. */
export const HANDLE_RE = /^[a-z0-9._-]{2,24}$/;

export type HandleValidation =
	| { ok: true }
	| { ok: false; reason: "format" };

export function normalizeHandleInput(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function validateHandle(raw: string): HandleValidation {
	const handle = normalizeHandleInput(raw);
	if (!HANDLE_RE.test(handle)) return { ok: false, reason: "format" };
	return { ok: true };
}
```

- [ ] **Step 2.4: Run tests — expect PASS**

```bash
cd apps/web && bun test src/lib/onboarding-handle-validation.test.ts
```

Expected: all tests PASS.

---

### Task 3: Taste state helpers (TDD)

**Files:**
- Create: `apps/web/src/lib/onboarding-taste-state.ts`
- Create: `apps/web/src/lib/onboarding-taste-state.test.ts`

- [ ] **Step 3.1: Write failing tests**

Create `apps/web/src/lib/onboarding-taste-state.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	canAdvanceOnboardingTaste,
	countOnboardingTasteRated,
	isOnboardingTasteSkipped,
} from "./onboarding-taste-state";

describe("countOnboardingTasteRated", () => {
	test("counts only rated titles", () => {
		const ratings = { 1: 80, 2: 70 };
		const skipped = new Set<number>([3]);
		expect(countOnboardingTasteRated(ratings, skipped)).toBe(2);
	});

	test("skipped rated id still counts if in ratings map", () => {
		const ratings = { 1: 80 };
		const skipped = new Set<number>([1]);
		expect(countOnboardingTasteRated(ratings, skipped)).toBe(1);
	});
});

describe("canAdvanceOnboardingTaste", () => {
	test("requires eight ratings by default", () => {
		const ratings = Object.fromEntries(
			Array.from({ length: 7 }, (_, i) => [i + 1, 80]),
		);
		expect(canAdvanceOnboardingTaste(ratings, new Set())).toBe(false);
		expect(
			canAdvanceOnboardingTaste(
				{ ...ratings, 99: 90 },
				new Set([1, 2, 3, 4]),
			),
		).toBe(true);
	});
});

describe("isOnboardingTasteSkipped", () => {
	test("reads skip set", () => {
		expect(isOnboardingTasteSkipped(5, new Set([5]))).toBe(true);
		expect(isOnboardingTasteSkipped(5, new Set())).toBe(false);
	});
});
```

- [ ] **Step 3.2: Run tests — expect FAIL**

```bash
cd apps/web && bun test src/lib/onboarding-taste-state.test.ts
```

- [ ] **Step 3.3: Implement taste state**

Create `apps/web/src/lib/onboarding-taste-state.ts`:

```ts
import { ONBOARDING_TASTE_MIN_RATED } from "./onboarding-types";

export function countOnboardingTasteRated(
	ratings: Record<number, number>,
	skipped: ReadonlySet<number>,
): number {
	return Object.keys(ratings).length;
}

export function isOnboardingTasteSkipped(
	movieId: number,
	skipped: ReadonlySet<number>,
): boolean {
	return skipped.has(movieId);
}

export function canAdvanceOnboardingTaste(
	ratings: Record<number, number>,
	_skipped: ReadonlySet<number>,
	minRated = ONBOARDING_TASTE_MIN_RATED,
): boolean {
	return countOnboardingTasteRated(ratings, _skipped) >= minRated;
}
```

- [ ] **Step 3.4: Run tests — expect PASS**

```bash
cd apps/web && bun test src/lib/onboarding-taste-state.test.ts
```

---

### Task 4: Finish orchestration (TDD)

**Files:**
- Create: `apps/web/src/lib/onboarding-finish.ts`
- Create: `apps/web/src/lib/onboarding-finish.test.ts`

- [ ] **Step 4.1: Write failing test for call order**

Create `apps/web/src/lib/onboarding-finish.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { runOnboardingFinish } from "./onboarding-finish";

describe("runOnboardingFinish", () => {
	test("calls avatar upload, logs, profile patch, then recompute", async () => {
		const calls: string[] = [];
		const result = await runOnboardingFinish(
			{
				avatarFile: new File(["x"], "a.png", { type: "image/png" }),
				tasteRatings: { 550: 80, 278: 90 },
				handle: "patron",
				displayName: "Patron",
				bio: "Hello",
				favoriteMovieIds: [550],
			},
			{
				uploadAvatar: async () => {
					calls.push("avatar");
				},
				postLog: async () => {
					calls.push("log");
				},
				patchProfile: async () => {
					calls.push("profile");
					return {};
				},
				recomputeTaste: async () => {
					calls.push("taste");
					return { headline: "You gravitate toward drama." };
				},
			},
		);

		expect(calls).toEqual(["avatar", "log", "log", "profile", "taste"]);
		expect(result.headline).toBe("You gravitate toward drama.");
	});
});
```

- [ ] **Step 4.2: Run test — expect FAIL**

```bash
cd apps/web && bun test src/lib/onboarding-finish.test.ts
```

- [ ] **Step 4.3: Implement finish orchestration**

Create `apps/web/src/lib/onboarding-finish.ts`:

```ts
import type { OnboardingMovie } from "./onboarding-types";

export type OnboardingFinishInput = {
	avatarFile: File | null;
	tasteRatings: Record<number, number>;
	handle: string;
	displayName: string;
	bio: string;
	favoriteMovieIds: number[];
};

export type OnboardingFinishDeps = {
	uploadAvatar: (file: File) => Promise<void>;
	postLog: (movieId: number, rating: number) => Promise<void>;
	patchProfile: (body: {
		handle: string;
		displayName: string;
		bio?: string;
		favoriteMovieIds: number[];
		markOnboarded: true;
	}) => Promise<unknown>;
	recomputeTaste: () => Promise<{ headline?: string }>;
};

export async function runOnboardingFinish(
	input: OnboardingFinishInput,
	deps: OnboardingFinishDeps,
): Promise<{ headline: string | null }> {
	if (input.avatarFile) {
		await deps.uploadAvatar(input.avatarFile);
	}

	for (const [movieIdStr, rating] of Object.entries(input.tasteRatings)) {
		await deps.postLog(Number(movieIdStr), rating);
	}

	await deps.patchProfile({
		handle: input.handle,
		displayName: input.displayName,
		bio: input.bio.trim() || undefined,
		favoriteMovieIds: input.favoriteMovieIds,
		markOnboarded: true,
	});

	const taste = await deps.recomputeTaste();
	return { headline: taste.headline?.trim() ?? null };
}

/** Map favorites tiles to id list for PATCH. */
export function favoriteMovieIdsFromTiles(movies: OnboardingMovie[]): number[] {
	return movies.map((m) => m.id);
}
```

Wire real deps in wizard later:

```ts
uploadAvatar: (file) => uploadProfileMeAsset("/api/profiles/me/avatar", file).then(() => {}),
postLog: (movieId, rating) => api.api.logs.post({ movieId, rating, watchedAt: new Date().toISOString(), visibility: "private", watchVenue: "streaming" }),
patchProfile: (body) => api.api.profiles.me.patch(body),
recomputeTaste: async () => (await api.api.profiles.me["recompute-taste-signature"].post()).data as { headline?: string },
```

- [ ] **Step 4.4: Run test — expect PASS**

```bash
cd apps/web && bun test src/lib/onboarding-finish.test.ts
```

- [ ] **Step 4.5: Run all onboarding lib tests**

```bash
cd apps/web && bun test src/lib/onboarding-handle-validation.test.ts src/lib/onboarding-taste-state.test.ts src/lib/onboarding-finish.test.ts
```

Expected: all PASS.

---

### Task 5: Slim sign-up form

**Files:**
- Modify: `apps/web/src/components/auth/sign-up-form.tsx`

- [ ] **Step 5.1: Remove name + handle fields**

In `sign-up-form.tsx`:
- Delete `HANDLE_RE`, `HandleStatus`, `handleValue` state, handle availability `useEffect`.
- Change `schema` to only `email` + `password` (remove `name`, `handle`).
- Change `defaultValues` to `{ email: "", password: "" }`.
- Remove `form.Field` blocks for `name` and `handle`.
- In `onSubmit`, remove `api.api.profiles.me.patch` call — only `authClient.signUp.email({ email, password, name: email.split("@")[0] ?? "Patron" })` (Better Auth requires `name`; use email local-part fallback).
- Keep toast + `router.replace("/onboarding")`.
- Remove `handleStatus.state === "taken"` from submit disabled check.
- Remove unused imports: `api`, `fetchProfileHandleAvailable`.

- [ ] **Step 5.2: Typecheck web app**

```bash
cd apps/web && bun run build
```

Expected: exit 0 (delete `.next` first if stale route types error per AGENTS.md).

---

### Task 6: Motion shell + letter reveal + layout

**Files:**
- Create: `apps/web/src/components/onboarding/onboarding-letter-reveal.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-step-shell.tsx`
- Create: `apps/web/src/components/onboarding/onboarding-wizard-layout.tsx`

- [ ] **Step 6.1: Letter reveal component**

Create `onboarding-letter-reveal.tsx` — export `OnboardingLetterReveal({ text, active }: { text: string; active: boolean })` using `motion/react` `AnimatePresence` + per-character `motion.span` (copy pattern from user reference). When `!active`, render plain text without animation. Respect `useReducedMotion()` → no stagger.

- [ ] **Step 6.2: Step shell**

Create `onboarding-step-shell.tsx`:

```tsx
"use client";

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import useMeasure from "react-use-measure";
import { type ReactNode, useEffect, useState } from "react";

const variants = {
	initial: (direction: number) => ({ x: `${110 * direction}%`, opacity: 0 }),
	active: { x: "0%", opacity: 1 },
	exit: (direction: number) => ({ x: `${-110 * direction}%`, opacity: 0 }),
};

export function OnboardingStepShell({
	stepKey,
	direction,
	children,
}: {
	stepKey: string;
	direction: number;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const transition = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] as const };
	const [ref, bounds] = useMeasure();
	const [hasMeasured, setHasMeasured] = useState(false);

	useEffect(() => {
		if (bounds.height > 0 && !hasMeasured) setHasMeasured(true);
	}, [bounds.height, hasMeasured]);

	return (
		<MotionConfig transition={transition}>
			<motion.div
				animate={{ height: bounds.height > 0 ? bounds.height : "auto" }}
				className="w-full max-w-[400px] shrink-0 overflow-hidden"
				initial={false}
				transition={
					hasMeasured ? transition : { duration: 0 }
				}
			>
				<div className="flex flex-col gap-8 p-6" ref={ref}>
					<AnimatePresence custom={direction} initial={false} mode="popLayout">
						<motion.div
							key={stepKey}
							animate="active"
							custom={direction}
							exit="exit"
							initial="initial"
							variants={variants}
						>
							{children}
						</motion.div>
					</AnimatePresence>
				</div>
			</motion.div>
		</MotionConfig>
	);
}
```

- [ ] **Step 6.3: Full-bleed layout**

Create `onboarding-wizard-layout.tsx` — full viewport `bg-background`, inner `bg-card rounded-3xl` flex container; `lg:flex-row` with wizard column + preview slot; mobile single column with optional `children.previewStrip`.

---

### Task 7: Live preview panel

**Files:**
- Create: `apps/web/src/components/onboarding/onboarding-preview-panel.tsx`

- [ ] **Step 7.1: Implement preview panel**

Props:

```ts
type OnboardingPreviewPanelProps = {
	step: WizardStep;
	displayName: string;
	handle: string;
	bio: string;
	avatarPreviewUrl: string | null;
	favorites: OnboardingMovie[];
	tasteHeadline: string | null;
	isTypingBio?: boolean;
};
```

Implement miniature profile card per spec §2:
- Banner gradient placeholder (`#c45c26` accent wash).
- Portrait `img` when `avatarPreviewUrl`, else skeleton circle.
- `OnboardingLetterReveal` for name, `@handle`, bio.
- Favorites row (poster thumbs) when `step === "favorites" | "done"`.
- `motion.div` wrapper with `animate={{ y, scale }}` per step table in spec.
- Return `null` on mobile when `step === "taste"` (wizard handles counter).
- Desktop edge scrims: `pointer-events-none` gradients from `bg-card`.

- [ ] **Step 7.2: Mobile preview strip**

Export `OnboardingPreviewStrip` — compact avatar + truncated name + `@handle` for `<lg` identity steps only.

---

### Task 8: Step components

**Files:**
- Create all files under `onboarding-steps/`

- [ ] **Step 8.1: `welcome-step.tsx`**

Copy + two buttons: “Set up now” (`onProceed`), “Maybe later” (`onSkipAbbreviated`). No back nav.

- [ ] **Step 8.2: `avatar-step.tsx`**

Drag-drop zone + file input (`accept="image/*"`). Call `assertProfileMediaUploadSize` on pick. Object URL preview. Continue disabled only if you require avatar — spec says **optional**, so Continue always enabled. Primary label: “Confirm my portrait” / “Skip for now”.

- [ ] **Step 8.3: `name-step.tsx`**

`Input` 16px+, `displayName` controlled. Continue disabled when `!displayName.trim()`.

- [ ] **Step 8.4: `handle-step.tsx`**

Debounced `fetchProfileHandleAvailable` (250ms, copy from old sign-up). Show availability helper. Continue calls `onConfirmHandle` async — parent runs `PATCH /api/profiles/me { handle, displayName }`. Disable when invalid/taken/checking.

- [ ] **Step 8.5: `bio-step.tsx`**

`Textarea` max 600, character counter. Optional bio — Continue always enabled. Optional `onSaveBio` incremental PATCH.

- [ ] **Step 8.6: `verify-email-step.tsx`**

Copy: “Verify your email to rate films and pin favorites.” Buttons: Resend (`authClient.sendVerificationEmail`), “I’ve verified” (`router.refresh()`). Reuse flat `bg-card` styling from `VerifyEmailBanner` patterns — no dismiss.

- [ ] **Step 8.7: `taste-step.tsx`**

Load pool IDs from `ONBOARDING_QUICK_RATE_TMDB_IDS.slice(0, 12)` via `api.api.movies({ id })` (copy fetch loop from old `onboarding-flow.tsx`). Grid with score chips 6–10, **Haven’t seen** button. Search row + rated shelf. Show `{countOnboardingTasteRated} / 8 rated`. Continue disabled until `canAdvanceOnboardingTaste`.

- [ ] **Step 8.8: `favorites-step.tsx`**

Reuse search + toggle grid from old `onboarding-flow.tsx` favorites section. Min 1 favorite. Submit runs `onFinish` (parent calls `runOnboardingFinish`).

- [ ] **Step 8.9: `done-step.tsx`**

“All set.” + optional `tasteHeadline` + “Taking you home…”

---

### Task 9: Wizard state machine

**Files:**
- Create: `apps/web/src/components/onboarding/onboarding-wizard.tsx`
- Modify: `apps/web/src/app/onboarding/page.tsx`
- Delete: `apps/web/src/components/onboarding/onboarding-flow.tsx`

- [ ] **Step 9.1: Wizard props**

```ts
export function OnboardingWizard({
	initialDisplayName,
	initialHandle,
	initialBio,
	emailVerified,
	userEmail,
}: {
	initialDisplayName: string;
	initialHandle: string;
	initialBio: string;
	emailVerified: boolean;
	userEmail: string;
});
```

- [ ] **Step 9.2: Navigation logic**

- `goNext` / `goBack` update `direction` ±1 and `step`.
- After `bio` → if `!emailVerified` go `verify`, else `taste`.
- On `router.refresh()` from verify step, parent re-passes `emailVerified`; wizard auto-advances to `taste` when true.
- `skipAbbreviated`: set `skipMode = "abbreviated"`, jump to `name` step (or stay on name/handle only sequence); on handle confirm → `PATCH { handle, displayName, markOnboarded: true }` → `/home`.
- Optional “Finish later” link on identity steps → same abbreviated finish when name+handle valid.

- [ ] **Step 9.3: Finish handler**

Use `runOnboardingFinish` with real API deps. On success → `setStep("done")`, `setTasteHeadline`, `setTimeout` 900ms → `router.replace("/home")`. On `EMAIL_VERIFICATION_REQUIRED` → toast + `setStep("verify")`. Other errors → `toast.error`.

- [ ] **Step 9.4: Update onboarding page**

In `onboarding/page.tsx`:
- Pass `emailVerified: session.user.emailVerified !== false` (treat undefined as verified for legacy).
- Pass `userEmail: session.user.email`.
- Wrap in `OnboardingWizardLayout` + `BrandMark` header row.
- Widen container from `max-w-2xl` to full-bleed layout.

- [ ] **Step 9.5: Delete old flow**

Remove `onboarding-flow.tsx`. Grep for imports — update to `OnboardingWizard`.

- [ ] **Step 9.6: Build**

```bash
cd apps/web && bun run build
```

Expected: exit 0.

---

### Task 10: Verification + manual QA

**Files:** none (QA)

- [ ] **Step 10.1: Run unit tests**

```bash
cd apps/web && bun test src/lib/onboarding-handle-validation.test.ts src/lib/onboarding-taste-state.test.ts src/lib/onboarding-finish.test.ts
```

- [ ] **Step 10.2: Manual QA checklist** (from spec §5)

1. Sign up unverified → complete identity → verify gate before taste.
2. Resend + verify → refresh → taste unlocks.
3. Skip 4 pool films, search-rate 8 → continue works.
4. Full finish → `/home` + taste signature on profile.
5. “Maybe later” → name + handle → `/home` without logs.
6. Reduced motion → instant transitions.
7. Mobile taste step hides large preview.

- [ ] **Step 10.3: Update spec status**

In `2026-06-14-onboarding-wizard-design.md`, change status line to **Plan ready — implementation in progress** (Executor marks **Shipped** when QA passes).

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Sign-up email + password only | Task 5 |
| Full identity wizard steps | Tasks 8–9 |
| Email gate before taste | Tasks 8.6, 9.2 |
| Haven’t seen + search, ≥8 rated | Tasks 3, 8.7 |
| Private log visibility on finish | Task 4 (`postLog` contract) |
| motion/react + useMeasure | Tasks 1, 6 |
| Live preview panel | Task 7 |
| Abbreviated skip | Task 9.2 |
| markOnboarded + taste recompute | Task 4, 9.3 |
| Unit tests | Tasks 2–4, 10.1 |

No placeholders remain. Type names (`WizardStep`, `runOnboardingFinish`) consistent across tasks.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-14-onboarding-wizard.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — one fresh subagent per task (1→10), you reply **go** between tasks for human verification per scratchpad workflow.

2. **Inline Execution** — implement tasks in this session with checkpoints after Tasks 4, 6, 9, and 10.

Which approach do you want?
