# Animated Profile Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Sense Pro patrons upload animated GIF banner and portrait (Discord-style), animate portraits everywhere they appear, and let all patrons toggle grayscale-until-hover on the profile hero portrait.

**Architecture:** Upload gate on Elysia `POST /me/avatar|banner` checks Pro + GIF MIME/extension; on success merge `avatarIsAnimated` / `bannerIsAnimated` into `profile.preferences`. Shared web readers in `profile-preferences.ts`. `PatronPortraitAvatar` switches to native `<img>` when animated; profile hero passes `grayscaleUntilHover` from `profilePortraitGrayscaleUntilHover` (default true). No new DB columns.

**Tech Stack:** Elysia + Vercel Blob (`apps/server`), Next.js App Router (`apps/web`), `bun:test`, Tailwind `grayscale` utilities.

**Spec:** `docs/superpowers/specs/2026-06-10-animated-profile-media-design.md`

---

## Conventions

- Pref keys (web + server must match):
  - `profilePortraitGrayscaleUntilHover` — default **true** when absent
  - `avatarIsAnimated` — default **false**
  - `bannerIsAnimated` — default **false**
- Tests: `bun:test`, colocated `*.test.ts`
- After code changes: `graphify update .`
- GIF detection helper: MIME `image/gif` **or** filename ends with `.gif` (case-insensitive)
- Do **not** commit unless the human asks

---

## File structure

**Create:**
- `apps/server/src/lib/profile-media.ts` — GIF detection, animation pref merge helpers
- `apps/server/src/lib/profile-media.test.ts`
- `apps/web/src/lib/profile-media.ts` — URL fallback inference for display (when flag missing)
- `apps/web/src/lib/profile-media.test.ts`
- `apps/web/src/lib/use-prefers-reduced-motion.ts` — tiny hook for portrait/banner components

**Modify:**
- `apps/server/src/routes/profiles.ts` — Pro GIF gate; set animation flags on upload; expose prefs on GET
- `apps/server/src/lib/sanitize-appearance-preferences.ts` — coerce boolean media prefs (optional; PATCH may pass through)
- `apps/web/src/lib/profile-preferences.ts` + `.test.ts` — constants + readers
- `apps/web/src/lib/upload-profile-me-asset.ts` — map `PRO_ANIMATED_MEDIA_REQUIRED` to friendly error
- `apps/web/src/components/profile/patron-portrait-avatar.tsx` — animated + grayscale + reduced-motion
- `apps/web/src/components/profile/profile-patron-header.tsx` — banner `<img>` when animated; delegate portrait props
- `apps/web/src/components/profile/profile-patron-lobby-shell.tsx` — pass animation + grayscale props into header
- `apps/web/src/components/profile/profile-media-customizer.tsx` — Pro GIF copy; detect pending GIF preview
- `apps/web/src/components/profile/me-profile-expression-settings.tsx` — grayscale toggle
- `apps/web/src/components/profile/settings-form-context.tsx` — state, dirty, PATCH merge for new pref
- `apps/web/src/components/profile/settings-section-panels.tsx` — wire toggle into Appearance (or pass props)
- `apps/web/src/components/app/nav-user-avatar.tsx` — `isAnimated` prop
- `apps/web/src/components/app/app-user-account-menu.tsx` — pass `isAnimated` from session/profile
- `apps/web/src/components/feed/feed-person-avatar.tsx` — extend `FeedPerson` + pass `isAnimated`
- `apps/server/src/lib/feed-items.ts` (or feed route) — include `avatarIsAnimated` on person payloads
- Other `PatronPortraitAvatar` call sites (leaderboards, curator spotlights, review sheets, search people row, follows drawer, following ratings) — pass `isAnimated` when payload has it

---

## Task 1: Shared profile-media helpers (server)

**Files:**
- Create: `apps/server/src/lib/profile-media.ts`
- Create: `apps/server/src/lib/profile-media.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import {
	isAnimatedGifUpload,
	readAvatarIsAnimatedPref,
	readBannerIsAnimatedPref,
	mergeAvatarAnimationPref,
} from "./profile-media";

describe("isAnimatedGifUpload", () => {
	test("detects image/gif mime", () => {
		const file = { type: "image/gif", name: "x.bin" } as File;
		expect(isAnimatedGifUpload(file)).toBe(true);
	});
	test("detects .gif extension when mime is generic", () => {
		const file = { type: "image/*", name: "loop.GIF" } as File;
		expect(isAnimatedGifUpload(file)).toBe(true);
	});
	test("rejects png", () => {
		const file = { type: "image/png", name: "a.png" } as File;
		expect(isAnimatedGifUpload(file)).toBe(false);
	});
});

describe("readAvatarIsAnimatedPref", () => {
	test("defaults false", () => {
		expect(readAvatarIsAnimatedPref(null)).toBe(false);
	});
	test("reads true flag", () => {
		expect(readAvatarIsAnimatedPref({ avatarIsAnimated: true })).toBe(true);
	});
});

describe("mergeAvatarAnimationPref", () => {
	test("sets true on gif upload", () => {
		expect(
			mergeAvatarAnimationPref({ foo: 1 }, true),
		).toEqual({ foo: 1, avatarIsAnimated: true });
	});
});
```

- [ ] **Step 2: Run tests (expect FAIL)**

Run: `cd apps/server && bun test src/lib/profile-media.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement `profile-media.ts`**

```ts
export const PROFILE_PREF_AVATAR_IS_ANIMATED = "avatarIsAnimated" as const;
export const PROFILE_PREF_BANNER_IS_ANIMATED = "bannerIsAnimated" as const;
export const PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER =
	"profilePortraitGrayscaleUntilHover" as const;

export const PRO_ANIMATED_MEDIA_REQUIRED = "PRO_ANIMATED_MEDIA_REQUIRED" as const;

export function isAnimatedGifUpload(file: File): boolean {
	const type = file.type?.toLowerCase() ?? "";
	if (type === "image/gif") return true;
	const name = file.name?.toLowerCase() ?? "";
	return name.endsWith(".gif");
}

export function readAvatarIsAnimatedPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_AVATAR_IS_ANIMATED] === true;
}

export function readBannerIsAnimatedPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_BANNER_IS_ANIMATED] === true;
}

export function readProfilePortraitGrayscaleUntilHoverPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return true;
	const raw = preferences[PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER];
	if (raw === false) return false;
	return true;
}

export function mergeAvatarAnimationPref(
	existing: Record<string, unknown>,
	isAnimated: boolean,
): Record<string, unknown> {
	return { ...existing, [PROFILE_PREF_AVATAR_IS_ANIMATED]: isAnimated };
}

export function mergeBannerAnimationPref(
	existing: Record<string, unknown>,
	isAnimated: boolean,
): Record<string, unknown> {
	return { ...existing, [PROFILE_PREF_BANNER_IS_ANIMATED]: isAnimated };
}
```

- [ ] **Step 4: Run tests (expect PASS)**

Run: `cd apps/server && bun test src/lib/profile-media.test.ts`

---

## Task 2: Pro GIF upload gate (avatar + banner)

**Files:**
- Modify: `apps/server/src/routes/profiles.ts` (handlers ~L421–551)

- [ ] **Step 1: Import helpers**

```ts
import {
	isAnimatedGifUpload,
	mergeAvatarAnimationPref,
	mergeBannerAnimationPref,
	PRO_ANIMATED_MEDIA_REQUIRED,
} from "../lib/profile-media";
```

- [ ] **Step 2: In `POST /me/banner` after file size check**

```ts
const [profileRow] = await db
	.select({ isPro: profile.isPro, preferences: profile.preferences })
	.from(profile)
	.where(eq(profile.userId, user.id))
	.limit(1);
if (!profileRow) return status(400, "Profile not found");

const wantsAnimated = isAnimatedGifUpload(file);
if (wantsAnimated && !profileRow.isPro) {
	return status(403, {
		error: "Animated banner requires Sense Pro",
		code: PRO_ANIMATED_MEDIA_REQUIRED,
	});
}
```

After successful `profile` update, also merge preferences:

```ts
const mergedPrefs = mergeBannerAnimationPref(
	(profileRow.preferences as Record<string, unknown>) ?? {},
	wantsAnimated,
);
await db
	.update(profile)
	.set({ preferences: mergedPrefs })
	.where(eq(profile.userId, user.id));
```

(Return still `{ url }` — preferences update can be same transaction block before return.)

- [ ] **Step 3: Mirror in `POST /me/avatar`**

Same Pro gate; on success update `user.image` **and** merge `avatarIsAnimated` into profile preferences (avatar bytes live on `user`, flags on `profile.preferences`).

- [ ] **Step 4: Manual smoke** (dev, Pro user): upload tiny GIF via Settings → Save; confirm `preferences.avatarIsAnimated === true` in DB or `GET /api/profiles/me`.

---

## Task 3: Web preference readers

**Files:**
- Modify: `apps/web/src/lib/profile-preferences.ts`
- Modify: `apps/web/src/lib/profile-preferences.test.ts`
- Create: `apps/web/src/lib/profile-media.ts`
- Create: `apps/web/src/lib/profile-media.test.ts`

- [ ] **Step 1: Add constants + readers to `profile-preferences.ts`**

Re-export server key strings (duplicate constants, same literals):

```ts
export const PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER =
	"profilePortraitGrayscaleUntilHover" as const;
export const PROFILE_PREF_AVATAR_IS_ANIMATED = "avatarIsAnimated" as const;
export const PROFILE_PREF_BANNER_IS_ANIMATED = "bannerIsAnimated" as const;

export function readProfilePortraitGrayscaleUntilHoverPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return true;
	return preferences[PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER] !== false;
}

export function readAvatarIsAnimatedPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_AVATAR_IS_ANIMATED] === true;
}

export function readBannerIsAnimatedPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_BANNER_IS_ANIMATED] === true;
}
```

- [ ] **Step 2: Add tests** (default true for grayscale; false for animation)

- [ ] **Step 3: `profile-media.ts` URL fallback**

```ts
export function inferAnimatedFromProfileUrl(
	storedUrl: string | null | undefined,
	flag: boolean | undefined,
): boolean {
	if (flag === true) return true;
	if (flag === false) return false;
	if (!storedUrl?.trim()) return false;
	return /\.gif(\?|$)/i.test(storedUrl);
}
```

- [ ] **Step 4: Run web tests**

Run: `cd apps/web && bun test src/lib/profile-preferences.test.ts src/lib/profile-media.test.ts`

---

## Task 4: `PatronPortraitAvatar` animated + grayscale + reduced motion

**Files:**
- Create: `apps/web/src/lib/use-prefers-reduced-motion.ts`
- Modify: `apps/web/src/components/profile/patron-portrait-avatar.tsx`

- [ ] **Step 1: Hook**

```ts
"use client";

import { useEffect, useState } from "react";

export function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReduced(mq.matches);
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, []);
	return reduced;
}
```

- [ ] **Step 2: Extend `PatronPortraitAvatar` props**

```ts
isAnimated?: boolean;
grayscaleUntilHover?: boolean;
respectReducedMotion?: boolean; // default true
```

- [ ] **Step 3: Rendering logic**

- Build `portraitSrc` unchanged (proxy URL).
- Grayscale classes when `grayscaleUntilHover`:

```ts
const grayscaleClass =
	grayscaleUntilHover
		? "grayscale [@media(hover:hover)]:hover:grayscale-0"
		: undefined;
```

- If `isAnimated && !(respectReducedMotion && reducedMotion)` → native `<img src={portraitSrc} alt="" className={cn("object-cover", grayscaleClass, className)} />`
- Else → existing Next `Image` path with same `className` merge.
- Note: when `respectReducedMotion && reducedMotion` and `isAnimated`, still use `<img>` but add class `motion-reduce:[animation-play-state:paused]` — best-effort; document limitation in code comment.

- [ ] **Step 4: Manual check** — Pro GIF avatar on profile + nav loops; grayscale only when `grayscaleUntilHover` passed.

---

## Task 5: Profile hero banner + portrait wiring

**Files:**
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx`
- Modify: `apps/web/src/components/profile/profile-patron-lobby-shell.tsx` (and profile page props source)

- [ ] **Step 1: Add header props**

```ts
avatarIsAnimated?: boolean;
bannerIsAnimated?: boolean;
profilePortraitGrayscaleUntilHover?: boolean;
```

- [ ] **Step 2: Banner render branch**

When `bannerIsAnimated`, replace Next `Image` with positioned `<img src={bannerSrc} alt="" className="absolute inset-0 size-full object-cover" />` (keep frame + gradient scrim).

- [ ] **Step 3: Portrait**

```tsx
<PatronPortraitAvatar
	handle={handle}
	avatarUrl={avatarUrl}
	name={displayName || initials}
	width={192}
	height={288}
	isAnimated={avatarIsAnimated}
	grayscaleUntilHover={profilePortraitGrayscaleUntilHover ?? true}
	className="size-full rounded-2xl"
/>
```

Remove hardcoded `grayscale` from header.

- [ ] **Step 4: Thread from RSC** — wherever `ProfilePatronLobbyShell` gets profile data, pass:

```ts
avatarIsAnimated: readAvatarIsAnimatedPref(profile.preferences)
	|| inferAnimatedFromProfileUrl(avatarUrl, readAvatarIsAnimatedPref(profile.preferences)),
bannerIsAnimated: readBannerIsAnimatedPref(profile.preferences)
	|| inferAnimatedFromProfileUrl(bannerUrl, readBannerIsAnimatedPref(profile.preferences)),
profilePortraitGrayscaleUntilHover: readProfilePortraitGrayscaleUntilHoverPref(profile.preferences),
```

Use flag-first, URL fallback only when flag absent.

---

## Task 6: Settings — grayscale toggle + Pro GIF copy

**Files:**
- Modify: `apps/web/src/components/profile/settings-form-context.tsx`
- Modify: `apps/web/src/components/profile/me-profile-expression-settings.tsx`
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx`
- Modify: `apps/web/src/components/profile/profile-media-customizer.tsx`
- Modify: `apps/web/src/lib/upload-profile-me-asset.ts`

- [ ] **Step 1: Form state** — add `profilePortraitGrayscaleUntilHover` with reader default `true`; include in PATCH `preferences` blob on save; dirty tracking like `castCrewMonochromeOnHover`.

- [ ] **Step 2: `MeProfileExpressionSettings`** — new prop `profilePortraitGrayscaleUntilHover` + `onProfilePortraitGrayscaleUntilHoverChange`; add `MePreferenceToggle` below banner frame fieldset (all patrons, not Pro-gated).

- [ ] **Step 3: `ProfileMediaCustomizer`** — accept `isPro?: boolean`; helper text:

```tsx
{isPro ? (
  <p className="text-muted-foreground text-xs">Sense Pro: upload animated GIF for banner and portrait.</p>
) : null}
```

- [ ] **Step 4: Upload error mapping** in `upload-profile-me-asset.ts`:

```ts
} else if (body.code === "PRO_ANIMATED_MEDIA_REQUIRED") {
	msg = "Animated banner and portrait require Sense Pro.";
}
```

- [ ] **Step 5: Settings save toast** — existing path surfaces thrown `Error(msg)`.

---

## Task 7: Thread `isAnimated` through feed + nav call sites

**Files:**
- Modify: `apps/server/src/lib/feed-items.ts` (or equivalent mapper)
- Modify: `apps/web/src/components/feed/feed-person-avatar.tsx`
- Modify: `apps/web/src/components/app/nav-user-avatar.tsx`
- Modify: `apps/web/src/components/app/app-user-account-menu.tsx`
- Modify: remaining `PatronPortraitAvatar` parents (grep list)

- [ ] **Step 1: Extend server feed person shape**

```ts
profile: { handle: string; displayName: string; avatarIsAnimated?: boolean } | null;
```

Populate `avatarIsAnimated` from `readAvatarIsAnimatedPref(row.preferences)` when joining profile in feed query.

- [ ] **Step 2: `FeedPersonAvatar`**

```tsx
<PatronPortraitAvatar
	...
	isAnimated={person.profile?.avatarIsAnimated ?? false}
/>
```

- [ ] **Step 3: Nav** — pass `isAnimated` from session user profile preferences (may require including prefs in session bootstrap or a lightweight `GET /api/profiles/me` field the shell already has).

- [ ] **Step 4: Grep pass** — `PatronPortraitAvatar` in:
  - `home-curator-spotlights.tsx`
  - `home-leaderboard-podium.tsx`
  - `home-leaderboard-row.tsx`
  - `search-dialog-people-row.tsx`
  - `profile-follows-drawer.tsx`
  - `movie-detail-following-ratings.tsx`
  - `movie-detail-reviews-carousel.tsx`
  - `review-detail-sheet.tsx`
  - `patron-watch-ledger-panel.tsx`

  Pass `isAnimated` when the parent payload includes it; otherwise `false` (safe default).

---

## Task 8: Verification

- [ ] **Server unit tests:** `bun test apps/server/src/lib/profile-media.test.ts`
- [ ] **Web unit tests:** `cd apps/web && bun test src/lib/profile-preferences.test.ts src/lib/profile-media.test.ts`
- [ ] **Typecheck:** `cd apps/web && bun run check-types` (or monorepo equivalent)
- [ ] **Manual matrix:**

| Case | Expected |
|------|----------|
| Pro uploads GIF avatar | Animates on profile + nav + feed |
| Non-Pro uploads GIF | Toast: requires Pro; no save |
| Grayscale toggle ON | Profile hero portrait grayscale → color on hover (GIF loops under filter) |
| Grayscale toggle OFF | Profile hero always color |
| `prefers-reduced-motion` | Best-effort static presentation |
| PNG upload | `avatarIsAnimated: false`; still Image path |

- [ ] **graphify update .**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Pro-only GIF upload | Task 2 |
| `avatarIsAnimated` / `bannerIsAnimated` prefs | Tasks 1–2, 3 |
| `profilePortraitGrayscaleUntilHover` | Tasks 3, 6 |
| GIF loops everywhere portrait appears | Tasks 4, 7 |
| Profile hero grayscale toggle only | Tasks 4–5 |
| CSS filter on looping GIF | Task 4 |
| Settings UI copy | Task 6 |
| `PRO_ANIMATED_MEDIA_REQUIRED` UX | Tasks 2, 6 |
| URL `.gif` fallback | Task 3, 5 |
| `prefers-reduced-motion` | Task 4 |
| OG unchanged | No task (out of scope) |
