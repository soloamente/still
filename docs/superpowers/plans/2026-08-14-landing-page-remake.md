# Landing page remake Implementation Plan

> **Superseded for remaining work.** Amendment: `docs/superpowers/plans/2026-08-14-landing-mobbin-grammar.md`. Tasks 1–8 of this file shipped the still + chapter layout; do not run Task 9 from here.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Human **go** between tasks. One task per subagent.

**Goal:** Remake unsigned `/` as identity → diary → community → convert: one cinematic still, then Sense raised-card chapters, Create account + Sign in.

**Architecture:** Pure helpers first (`pickLandingHeroBackdrop`, `landing-copy`). Then Sense chrome (nav, hero, three chapter cards, convert footer). Slim the popular fetch to one backdrop. Delete the Mobbin theater stack once `page.tsx` no longer imports it.

**Tech Stack:** Next.js App Router, React 19, `next/image`, `motion/react` (`useReducedMotion` via existing `useTextStateSwap`), Tailwind, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-08-14-landing-page-remake-design.md`

## Global Constraints

- Product name is **Sense**. Packages stay `@still/*`.
- Motion imports are `motion/react`, never `framer-motion`.
- Sentence case. No “friends”. Diary copy says **cinema** / **at home**, never **In cinemas**.
- No decorative borders, rings, or box-shadows. Surface depth only (`bg-background` → `bg-card` → inset `bg-background`).
- No scroll-hijack, parallax, fade-up-on-scroll, Ken Burns, trailer, or still slideshow.
- transitions-dev: reuse `.t-text-swap` / `useTextStateSwap` for Menu ↔ Close only. Do not duplicate `:root` tokens.
- Do not put `data-lenis-prevent-wheel` on chapter cards.
- Do not change signed-in `/` redirect. Do not change global `APP_METADATA_DESCRIPTION`.
- `font-sans` only — no Fraunces `font-display` on this page.
- CTAs: **Create account** → `/sign-up`, **Sign in** → `/sign-in`. Hits ≥ 44px (`h-11`).
- Comments explain why. Do not delete old comments unless the code they describe is gone.
- TDD on pure helpers. Run `cd apps/web && bun test <file>` — expect FAIL then PASS.
- Commit only if the human asked this session; otherwise leave the working tree uncommitted and skip each Commit step.

---

## File map

| File | Role |
| --- | --- |
| `apps/web/src/app/_marketing/landing-hero-still.ts` | First backdrop URL or `null` |
| `apps/web/src/app/_marketing/landing-copy.ts` | All landing strings + chapter IDs |
| `apps/web/src/app/_marketing/landing-hero.tsx` | `#scene` still + identity + CTAs |
| `apps/web/src/app/_marketing/landing-nav.tsx` | Sticky Sense nav + mobile sheet |
| `apps/web/src/app/_marketing/landing-mark-pill.tsx` | Sense wordmark pill |
| `apps/web/src/app/_marketing/landing-chapter.tsx` | Raised-card chapter shell |
| `apps/web/src/app/_marketing/landing-taste-visual.tsx` | Static Genre-led specimen |
| `apps/web/src/app/_marketing/landing-convert.tsx` | `#start` convert band |
| `apps/web/src/app/_marketing/landing-footer.tsx` | Convert + quiet links |
| `apps/web/src/app/_marketing/landing-feature-visuals.tsx` | Keep Quick Log + ranks only |
| `apps/web/src/app/_marketing/landing-mobbin-hero.ts` | Slim to tokens the remake still uses |
| `apps/web/src/app/page.tsx` | Compose remake; slim fetch; skip link |
| Delete list | Task 9 |

---

### Task 1: `pickLandingHeroBackdrop`

**Files:**
- Create: `apps/web/src/app/_marketing/landing-hero-still.test.ts`
- Create: `apps/web/src/app/_marketing/landing-hero-still.ts`

**Interfaces:**
- Consumes: popular-movies rows with optional `backdrop_url`
- Produces: `pickLandingHeroBackdrop(results) => string | null` and `LandingHeroStillSource`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";

import { pickLandingHeroBackdrop } from "./landing-hero-still";

describe("pickLandingHeroBackdrop", () => {
	test("returns null for empty or missing lists", () => {
		expect(pickLandingHeroBackdrop(null)).toBeNull();
		expect(pickLandingHeroBackdrop(undefined)).toBeNull();
		expect(pickLandingHeroBackdrop([])).toBeNull();
	});

	test("skips rows without a backdrop and returns the first URL", () => {
		expect(
			pickLandingHeroBackdrop([
				{ backdrop_url: null },
				{ backdrop_url: "   " },
				{ backdrop_url: "https://image.tmdb.org/t/p/w1280/a.jpg" },
				{ backdrop_url: "https://image.tmdb.org/t/p/w1280/b.jpg" },
			]),
		).toBe("https://image.tmdb.org/t/p/w1280/a.jpg");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/app/_marketing/landing-hero-still.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
/** Popular-list row — only the backdrop field the landing hero reads. */
export interface LandingHeroStillSource {
	backdrop_url?: string | null;
}

/** First non-empty backdrop URL, or null. Never fall back to a poster. */
export function pickLandingHeroBackdrop(
	results:
		| readonly (LandingHeroStillSource | null | undefined)[]
		| null
		| undefined,
): string | null {
	if (!results?.length) return null;
	for (const row of results) {
		const url = row?.backdrop_url?.trim();
		if (url) return url;
	}
	return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/app/_marketing/landing-hero-still.test.ts`

Expected: PASS (2 tests)

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-hero-still.ts apps/web/src/app/_marketing/landing-hero-still.test.ts
git commit -m "test: pick first TMDb backdrop for the landing hero"
```

---

### Task 2: Landing copy + href contract

**Files:**
- Create: `apps/web/src/app/_marketing/landing-copy.test.ts`
- Create: `apps/web/src/app/_marketing/landing-copy.ts`

**Interfaces:**
- Consumes: none
- Produces: `LANDING_CHAPTERS`, `LANDING_HERO_COPY`, `LANDING_CTA`, `LANDING_CHAPTER_COPY`, `LANDING_CONVERT_COPY`, `LANDING_TASTE_SPECIMEN`, `LANDING_FOOTER_LINKS`, `LANDING_METADATA_DESCRIPTION`, `LANDING_SKIP_HREF`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";

import {
	LANDING_CHAPTER_COPY,
	LANDING_CHAPTERS,
	LANDING_CONVERT_COPY,
	LANDING_CTA,
	LANDING_FOOTER_LINKS,
	LANDING_METADATA_DESCRIPTION,
	LANDING_SKIP_HREF,
} from "./landing-copy";

describe("landing copy contract", () => {
	test("nav chapters match Taste Diary Community ids", () => {
		expect(LANDING_CHAPTERS.map((chapter) => chapter.href)).toEqual([
			"#taste",
			"#diary",
			"#community",
		]);
		expect(LANDING_CHAPTERS.map((chapter) => chapter.id)).toEqual([
			"taste",
			"diary",
			"community",
		]);
		expect(LANDING_CHAPTERS.map((chapter) => chapter.label)).toEqual([
			"Taste",
			"Diary",
			"Community",
		]);
	});

	test("convert and skip targets stay on the locked routes", () => {
		expect(LANDING_CTA.primary).toEqual({
			href: "/sign-up",
			label: "Create account",
		});
		expect(LANDING_CTA.secondary).toEqual({
			href: "/sign-in",
			label: "Sign in",
		});
		expect(LANDING_SKIP_HREF).toBe("#main-content");
		expect(LANDING_CONVERT_COPY.heading).toBe("Start a free account");
		expect(LANDING_METADATA_DESCRIPTION).toContain("social identity");
		expect(LANDING_FOOTER_LINKS.map((link) => link.href)).toEqual([
			"/pricing",
			"/changelog",
			"/sign-in",
		]);
	});

	test("community copy does not say friends", () => {
		expect(LANDING_CHAPTER_COPY.community.body.toLowerCase()).not.toContain(
			"friend",
		);
	});
});
```

Import `LANDING_CHAPTER_COPY` at the top with the other bindings.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/app/_marketing/landing-copy.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export const LANDING_SKIP_HREF = "#main-content";

export const LANDING_METADATA_DESCRIPTION =
	"A social identity for how you watch. Log films and shows, then find people who see film the same way.";

export const LANDING_CHAPTERS = [
	{ id: "taste", href: "#taste", label: "Taste" },
	{ id: "diary", href: "#diary", label: "Diary" },
	{ id: "community", href: "#community", label: "Community" },
] as const;

export const LANDING_HERO_COPY = {
	headline: "Your taste is the point.",
	subline:
		"A social identity for how you watch — then a diary, lists, and people who see film the same way.",
} as const;

export const LANDING_CTA = {
	primary: { href: "/sign-up", label: "Create account" },
	secondary: { href: "/sign-in", label: "Sign in" },
} as const;

export const LANDING_CHAPTER_COPY = {
	taste: {
		heading: "Who you are as a watcher",
		body: "Sense reads your diary into a signature — an archetype and the genres that lead. People can see how you watch before they open a list.",
	},
	diary: {
		heading: "Log the night, not just the title",
		body: "Venue, date, and a 0–10 score in one pass. New logs default to at home. Cinema when you were there.",
	},
	community: {
		heading: "People who watch like you",
		body: "Lists, reviews, and ranks — follow patrons and see who logged what.",
	},
} as const;

export const LANDING_CONVERT_COPY = {
	heading: "Start a free account",
	body: "Log tonight. Your taste signature forms as you watch.",
} as const;

export const LANDING_TASTE_SPECIMEN = {
	pill: "Genre-led",
	line: "Drama leads, with Thriller in rotation.",
} as const;

export const LANDING_FOOTER_LINKS = [
	{ href: "/pricing", label: "Pricing" },
	{ href: "/changelog", label: "Changelog" },
	{ href: "/sign-in", label: "Sign in" },
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/app/_marketing/landing-copy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-copy.ts apps/web/src/app/_marketing/landing-copy.test.ts
git commit -m "feat: lock landing copy and chapter hrefs"
```

---

### Checkpoint: After Tasks 1–2

- [ ] Both bun test files pass
- [ ] Human **go** before UI work

---

### Task 3: CTA tokens + Sense wordmark

**Files:**
- Modify: `apps/web/src/app/_marketing/landing-mobbin-hero.ts` (secondary CTA + focus rings; add chapter/nav tokens)
- Modify: `apps/web/src/app/_marketing/landing-mark-pill.tsx`

**Interfaces:**
- Consumes: `APP_NAME` from `@/lib/app-brand`
- Produces: borderless secondary CTA; `LANDING_CHAPTER_CARD_CLASS`, `LANDING_CHAPTER_WELL_CLASS`, `LANDING_NAV_SCRIM_CLASS`, `LANDING_SKIP_LINK_CLASS`; wordmark pill

- [ ] **Step 1: Update CTA + add remake tokens**

In `landing-mobbin-hero.ts`:

Replace `LANDING_HERO_CTA_PRIMARY_CLASS` and `LANDING_HERO_CTA_SECONDARY_CLASS` with:

```ts
const LANDING_FOCUS_RING_CLASS =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Inverted primary pill — 44px hit, no decorative border. */
export const LANDING_HERO_CTA_PRIMARY_CLASS =
	`inline-flex h-11 min-w-[9.5rem] select-none items-center justify-center rounded-full bg-foreground px-6 font-sans font-semibold text-background text-sm transition-opacity duration-200 [@media(hover:hover)]:opacity-90 active:opacity-85 ${LANDING_FOCUS_RING_CLASS}`;

/** Raised secondary pill — bg-card, no border. */
export const LANDING_HERO_CTA_SECONDARY_CLASS =
	`inline-flex h-11 min-w-[9.5rem] select-none items-center justify-center rounded-full bg-card px-6 font-sans text-foreground text-sm transition-opacity duration-200 [@media(hover:hover)]:opacity-90 active:opacity-85 ${LANDING_FOCUS_RING_CLASS}`;
```

Append (do not delete unused Mobbin exports yet — old sections still import them until Task 8–9):

```ts
/** Raised chapter shell — outer 24, pad 8, inner 16. */
export const LANDING_CHAPTER_CARD_CLASS =
	"rounded-mobbin-3xl bg-card p-2 sm:p-3";

export const LANDING_CHAPTER_WELL_CLASS =
	"flex min-h-48 items-center justify-center rounded-2xl bg-background p-6 sm:min-h-56 sm:p-8";

/** Sticky nav scroll scrim — same recipe as ProfileTopBar. */
export const LANDING_NAV_SCRIM_CLASS =
	"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[clamp(7rem,42svh,18rem)] after:bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklab,var(--background)_92%,transparent)_14%,color-mix(in_oklab,var(--background)_68%,transparent)_38%,color-mix(in_oklab,var(--background)_32%,transparent)_68%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none";

export const LANDING_SKIP_LINK_CLASS =
	"sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:inline-flex focus:h-11 focus:items-center focus:rounded-full focus:bg-card focus:px-4 focus:font-sans focus:text-foreground focus:text-sm";
```

Keep `LANDING_HERO_HEADLINE_CLASS`, `LANDING_HERO_SUBLINE_CLASS`, `LANDING_HERO_CTA_ROW_CLASS`. Headline/subline stay `font-sans`.

- [ ] **Step 2: Rewrite the mark pill**

Replace `landing-mark-pill.tsx` with:

```tsx
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { APP_NAME } from "@/lib/app-brand";

/** Sense wordmark in a raised card pill — not the old three-dot glass mark. */
export function LandingMarkPill({
	className,
	href = "/",
}: {
	className?: string;
	href?: string;
}) {
	return (
		<Link
			href={href}
			aria-label={`${APP_NAME} — home`}
			className={cn(
				"inline-flex h-11 min-w-11 select-none items-center justify-center rounded-full bg-card px-4 font-sans font-semibold text-foreground text-sm",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				className,
			)}
		>
			{APP_NAME}
		</Link>
	);
}
```

- [ ] **Step 3: Typecheck the two files**

Run: `cd apps/web && bunx tsc --noEmit --pretty false 2>&1 | rg "landing-mark-pill|landing-mobbin-hero" || true`

Expected: no errors in those two files. Existing landing-nav still compiles (it imported glass; mark pill no longer needs glass).

- [ ] **Step 4: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-mobbin-hero.ts apps/web/src/app/_marketing/landing-mark-pill.tsx
git commit -m "feat: Sense wordmark and borderless landing CTAs"
```

---

### Task 4: Hero `#scene`

**Files:**
- Modify: `apps/web/src/app/_marketing/landing-hero.tsx`

**Interfaces:**
- Consumes: `backdropUrl: string | null`; `LANDING_HERO_COPY`, `LANDING_CTA`; CTA/headline tokens
- Produces: `<LandingHero backdropUrl={string | null} />` — full-bleed still, peek of next chapter, no preview well

- [ ] **Step 1: Replace `landing-hero.tsx`**

```tsx
import Image from "next/image";
import Link from "next/link";

import { LANDING_CTA, LANDING_HERO_COPY } from "./landing-copy";
import {
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_ROW_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
	LANDING_HERO_HEADLINE_CLASS,
	LANDING_HERO_SUBLINE_CLASS,
} from "./landing-mobbin-hero";

/** Short top scrim so sticky nav stays readable on the still. */
const HERO_TOP_SCRIM_CLASS =
	"pointer-events-none absolute inset-x-0 top-0 z-2 h-40 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.22)_45%,transparent_100%)]";

/** Long fade into canvas — not --card (Taste sits on background). */
const HERO_BOTTOM_SCRIM_CLASS =
	"pointer-events-none absolute inset-0 z-2 bg-[linear-gradient(to_top,var(--background)_0%,color-mix(in_oklab,var(--background)_88%,transparent)_8%,color-mix(in_oklab,var(--background)_55%,transparent)_18%,color-mix(in_oklab,var(--background)_22%,transparent)_28%,transparent_42%)]";

/**
 * Identity hero — one decorative still, copy on the bottom scrim.
 * min-h leaves a 16px peek of the Taste card (not a locked 100dvh slide).
 */
export function LandingHero({
	backdropUrl,
}: {
	backdropUrl: string | null;
}) {
	return (
		<section
			id="scene"
			className="relative flex min-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden bg-background"
		>
			{backdropUrl ? (
				<Image
					src={backdropUrl}
					alt=""
					fill
					priority
					sizes="100vw"
					className="object-cover"
				/>
			) : null}
			<div className={HERO_TOP_SCRIM_CLASS} aria-hidden />
			<div className={HERO_BOTTOM_SCRIM_CLASS} aria-hidden />

			<div className="relative z-10 mx-auto mt-auto flex w-full max-w-mobbin-page flex-col items-center px-4 pb-16 text-center sm:px-6 sm:pb-20">
				<h1 className={LANDING_HERO_HEADLINE_CLASS}>
					{LANDING_HERO_COPY.headline}
				</h1>
				<p className={`${LANDING_HERO_SUBLINE_CLASS} text-pretty`}>
					{LANDING_HERO_COPY.subline}
				</p>
				<div className={LANDING_HERO_CTA_ROW_CLASS}>
					<Link
						href={LANDING_CTA.primary.href}
						className={LANDING_HERO_CTA_PRIMARY_CLASS}
					>
						{LANDING_CTA.primary.label}
					</Link>
					<Link
						href={LANDING_CTA.secondary.href}
						className={LANDING_HERO_CTA_SECONDARY_CLASS}
					>
						{LANDING_CTA.secondary.label}
					</Link>
				</div>
			</div>
		</section>
	);
}
```

`page.tsx` still calls `<LandingHero />` with no props until Task 8. Add a default so the tree still typechecks:

```tsx
export function LandingHero({
	backdropUrl = null,
}: {
	backdropUrl?: string | null;
}) {
```

- [ ] **Step 2: Confirm no preview-stage import**

`landing-hero.tsx` must not import `LandingHeroPreviewStage`.

- [ ] **Step 3: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-hero.tsx
git commit -m "feat: cinematic identity hero for unsigned landing"
```

---

### Task 5: Sticky nav + mobile `t-text-swap`

**Files:**
- Modify: `apps/web/src/app/_marketing/landing-nav.tsx`

**Interfaces:**
- Consumes: `LANDING_CHAPTERS`, `LANDING_CTA`; `useTextStateSwap`; `LANDING_NAV_SCRIM_CLASS`; `LandingMarkPill`
- Produces: sticky Sense nav; Menu/Close text swap; no glass; no Contact

- [ ] **Step 1: Replace `landing-nav.tsx`**

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useTextStateSwap } from "@/lib/text-state-swap";

import { LANDING_CHAPTERS, LANDING_CTA } from "./landing-copy";
import {
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
	LANDING_NAV_SCRIM_CLASS,
} from "./landing-mobbin-hero";
import { LandingMarkPill } from "./landing-mark-pill";

const NAV_LINK_CLASS = cn(
	"inline-flex h-11 select-none items-center rounded-full px-4 font-sans text-foreground text-sm",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

export function LandingNav({ className }: { className?: string }) {
	const [open, setOpen] = useState(false);
	const [isScrolled, setIsScrolled] = useState(false);
	const menuLabel = open ? "Close" : "Menu";
	const menuLabelRef = useTextStateSwap(menuLabel);

	useEffect(() => {
		const onScroll = () => {
			setIsScrolled(window.scrollY > 2);
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<>
			<header
				className={cn(
					"sticky top-0 z-40 w-full",
					LANDING_NAV_SCRIM_CLASS,
					isScrolled && "after:opacity-100",
					className,
				)}
			>
				<div className="mx-auto grid w-full max-w-mobbin-page grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 px-4 py-3 sm:px-6">
					<div className="flex min-w-0 justify-start">
						<LandingMarkPill />
					</div>

					<nav
						className="hidden items-center justify-center md:flex"
						aria-label="Site sections"
					>
						{LANDING_CHAPTERS.map((link) => (
							<Link key={link.href} href={link.href} className={NAV_LINK_CLASS}>
								{link.label}
							</Link>
						))}
					</nav>

					<div className="hidden items-center justify-end gap-1 md:flex">
						<Link
							href={LANDING_CTA.secondary.href}
							className={LANDING_HERO_CTA_SECONDARY_CLASS}
						>
							{LANDING_CTA.secondary.label}
						</Link>
						<Link
							href={LANDING_CTA.primary.href}
							className={LANDING_HERO_CTA_PRIMARY_CLASS}
						>
							{LANDING_CTA.primary.label}
						</Link>
					</div>

					<div className="col-start-3 flex justify-end md:hidden">
						<button
							type="button"
							className={cn(NAV_LINK_CLASS, "bg-card")}
							aria-expanded={open}
							aria-controls="landing-mobile-menu"
							onClick={() => setOpen((value) => !value)}
						>
							<span ref={menuLabelRef} className="t-text-swap">
								{menuLabel}
							</span>
						</button>
					</div>
				</div>
			</header>

			{open ? (
				<div
					id="landing-mobile-menu"
					role="dialog"
					aria-modal="true"
					aria-label="Site menu"
					className="fixed inset-0 z-50 flex flex-col bg-background px-6 pt-20 pb-10 md:hidden"
				>
					<nav
						className="flex flex-1 flex-col gap-2"
						aria-label="Site sections"
					>
						{LANDING_CHAPTERS.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="inline-flex min-h-11 items-center font-sans font-semibold text-2xl text-foreground tracking-[-0.03em]"
								onClick={() => setOpen(false)}
							>
								{link.label}
							</Link>
						))}
					</nav>
					<div className="flex flex-col gap-3">
						<Link
							href={LANDING_CTA.secondary.href}
							className={LANDING_HERO_CTA_SECONDARY_CLASS}
							onClick={() => setOpen(false)}
						>
							{LANDING_CTA.secondary.label}
						</Link>
						<Link
							href={LANDING_CTA.primary.href}
							className={LANDING_HERO_CTA_PRIMARY_CLASS}
							onClick={() => setOpen(false)}
						>
							{LANDING_CTA.primary.label}
						</Link>
					</div>
				</div>
			) : null}
		</>
	);
}
```

The 3-column grid is `minmax(max-content,1fr) | auto | minmax(max-content,1fr)` so chapter labels stay centered and side tracks shrink first. Mobile: mark left, Menu right (row 1 cols 1 and 3).

- [ ] **Step 2: Confirm no `landing-glass` import**

- [ ] **Step 3: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-nav.tsx
git commit -m "feat: sticky Sense landing nav with chapter anchors"
```

---

### Task 6: Chapter cards + specimens

**Files:**
- Create: `apps/web/src/app/_marketing/landing-chapter.tsx`
- Create: `apps/web/src/app/_marketing/landing-taste-visual.tsx`
- Modify: `apps/web/src/app/_marketing/landing-feature-visuals.tsx` (ranks tiles → flat `bg-background`; keep Quick Log)

**Interfaces:**
- Consumes: `LANDING_CHAPTER_COPY`, `LANDING_TASTE_SPECIMEN`, `LANDING_CHAPTERS[n].id`
- Produces: `<LandingChapter id heading body>{specimen}</LandingChapter>`; `<LandingTasteVisual />`

- [ ] **Step 1: Taste specimen**

```tsx
import { LANDING_TASTE_SPECIMEN } from "./landing-copy";

/** Decorative taste pill — not a live signature, not interactive. */
export function LandingTasteVisual() {
	return (
		<div className="flex flex-col items-center gap-3" aria-hidden>
			<span className="inline-flex min-h-9 items-center rounded-full bg-card px-3 py-1.5 font-sans font-medium text-foreground text-sm">
				{LANDING_TASTE_SPECIMEN.pill}
			</span>
			<p className="max-w-[22ch] text-pretty text-center font-sans text-muted-foreground text-sm">
				{LANDING_TASTE_SPECIMEN.line}
			</p>
		</div>
	);
}
```

- [ ] **Step 2: Chapter shell**

```tsx
import type { ReactNode } from "react";

import {
	LANDING_CHAPTER_CARD_CLASS,
	LANDING_CHAPTER_WELL_CLASS,
} from "./landing-mobbin-hero";

export function LandingChapter({
	id,
	heading,
	body,
	children,
}: {
	id: string;
	heading: string;
	body: string;
	children: ReactNode;
}) {
	return (
		<section id={id} className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
			<div className={`mx-auto w-full max-w-mobbin-page ${LANDING_CHAPTER_CARD_CLASS}`}>
				<div className="grid items-center gap-8 rounded-2xl px-5 py-8 sm:grid-cols-2 sm:gap-10 sm:px-8 sm:py-10">
					<div className="max-w-md text-pretty">
						<h2 className="text-balance font-sans font-semibold text-[clamp(1.75rem,3.5vw,2.25rem)] text-foreground leading-[1.1] tracking-[-0.03em]">
							{heading}
						</h2>
						<p className="mt-4 font-sans text-muted-foreground text-sm leading-relaxed sm:text-base">
							{body}
						</p>
					</div>
					<div className={LANDING_CHAPTER_WELL_CLASS}>{children}</div>
				</div>
			</div>
		</section>
	);
}
```

- [ ] **Step 3: Flatten ranks tiles**

In `LandingFeatureRanksVisual`, change `rounded-xl bg-muted/40` / `bg-muted/65` to `rounded-xl bg-background` / `bg-background` (apex can stay slightly distinct via `min-h-22` only — no extra border). Keep caption **Film ranks · Month**. Do not add TV labels.

Leave unused visuals in the file until Task 9 (features.tsx still imports them).

- [ ] **Step 4: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-chapter.tsx apps/web/src/app/_marketing/landing-taste-visual.tsx apps/web/src/app/_marketing/landing-feature-visuals.tsx
git commit -m "feat: landing chapter cards and taste specimen"
```

---

### Task 7: Convert band + footer

**Files:**
- Create: `apps/web/src/app/_marketing/landing-convert.tsx`
- Modify: `apps/web/src/app/_marketing/landing-footer.tsx`

**Interfaces:**
- Consumes: `LANDING_CONVERT_COPY`, `LANDING_CTA`, `LANDING_CHAPTERS`, `LANDING_FOOTER_LINKS`, `APP_NAME`
- Produces: `#start` as first child of `<footer>`; no `border-t`; no scroll-reveal

- [ ] **Step 1: Convert band**

```tsx
import Link from "next/link";

import { LANDING_CONVERT_COPY, LANDING_CTA } from "./landing-copy";
import {
	LANDING_FEATURES_SECTION_TITLE_CLASS,
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_ROW_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
} from "./landing-mobbin-hero";

export function LandingConvert() {
	return (
		<section id="start" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
			<div className="mx-auto max-w-[40ch] text-center">
				<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
					{LANDING_CONVERT_COPY.heading}
				</h2>
				<p className="mt-4 text-pretty font-sans text-muted-foreground text-sm leading-relaxed">
					{LANDING_CONVERT_COPY.body}
				</p>
				<div className={`${LANDING_HERO_CTA_ROW_CLASS} justify-center`}>
					<Link
						href={LANDING_CTA.primary.href}
						className={LANDING_HERO_CTA_PRIMARY_CLASS}
					>
						{LANDING_CTA.primary.label}
					</Link>
					<Link
						href={LANDING_CTA.secondary.href}
						className={LANDING_HERO_CTA_SECONDARY_CLASS}
					>
						{LANDING_CTA.secondary.label}
					</Link>
				</div>
			</div>
		</section>
	);
}
```

- [ ] **Step 2: Replace footer**

```tsx
import Link from "next/link";

import { APP_NAME } from "@/lib/app-brand";

import { LANDING_CHAPTERS, LANDING_FOOTER_LINKS } from "./landing-copy";
import { LandingConvert } from "./landing-convert";

const FOOTER_LINK_CLASS =
	"font-sans text-muted-foreground text-sm [@media(hover:hover)]:text-foreground";

export function LandingFooter() {
	const year = new Date().getFullYear();

	return (
		<footer className="bg-background">
			<LandingConvert />
			<div className="px-4 pb-12 sm:px-6">
				<div className="mx-auto flex w-full max-w-mobbin-page flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
					<p className="font-sans font-semibold text-foreground text-sm">
						{APP_NAME}
					</p>
					<nav aria-label="Site" className="flex flex-wrap gap-x-10 gap-y-6">
						<ul className="space-y-2">
							{LANDING_CHAPTERS.map((link) => (
								<li key={link.href}>
									<Link href={link.href} className={FOOTER_LINK_CLASS}>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
						<ul className="space-y-2">
							{LANDING_FOOTER_LINKS.map((link) => (
								<li key={link.href}>
									<Link href={link.href} className={FOOTER_LINK_CLASS}>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				</div>
				<p className="mx-auto mt-10 w-full max-w-mobbin-page font-sans text-muted-foreground text-xs">
					© {year} {APP_NAME}.
				</p>
			</div>
		</footer>
	);
}
```

No `border-t`. No Product / Features / Catalogue. No diary-first blurb.

- [ ] **Step 3: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-convert.tsx apps/web/src/app/_marketing/landing-footer.tsx
git commit -m "feat: landing convert band and quiet footer"
```

---

### Task 8: Compose `/` + slim fetch + skip link

**Files:**
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `pickLandingHeroBackdrop`, `LANDING_METADATA_DESCRIPTION`, `LANDING_SKIP_HREF`, `LANDING_SKIP_LINK_CLASS`, `LANDING_CHAPTER_COPY`, chapter visuals
- Produces: remake page; signed-in redirect unchanged

- [ ] **Step 1: Replace the unsigned return + metadata description**

Keep `generateMetadata` structure, `authServer` / onboarding redirect, `dynamic = "force-dynamic"`, OG `/og/home`.

Change only the landing `description` string to `LANDING_METADATA_DESCRIPTION` (import it). Leave `APP_METADATA_DESCRIPTION` on OG/twitter if those fields currently use the global constant — spec says landing metadata description only. Use `LANDING_METADATA_DESCRIPTION` for the page `description` field. Keep `APP_METADATA_DESCRIPTION` on `openGraph.description` / `twitter.description` **or** use the landing string for all three page-level fields (page + og + twitter on `/` only). Prefer the landing string for all three `/` metadata fields so share cards match the new hero. Do not edit `app-brand.ts`.

Replace the popular mapping + JSX with:

```tsx
	const popular = await api.api.movies.popular
		.get()
		.catch(() => ({ data: null }));
	const backdropUrl = pickLandingHeroBackdrop(
		(
			popular.data as {
				results?: { backdrop_url?: string | null }[];
			} | null
		)?.results,
	);

	return (
		<div className="min-h-dvh bg-background text-foreground">
			<a href={LANDING_SKIP_HREF} className={LANDING_SKIP_LINK_CLASS}>
				Skip to content
			</a>
			<LandingNav />
			<main id="main-content">
				<LandingHero backdropUrl={backdropUrl} />
				<LandingChapter
					id="taste"
					heading={LANDING_CHAPTER_COPY.taste.heading}
					body={LANDING_CHAPTER_COPY.taste.body}
				>
					<LandingTasteVisual />
				</LandingChapter>
				<LandingChapter
					id="diary"
					heading={LANDING_CHAPTER_COPY.diary.heading}
					body={LANDING_CHAPTER_COPY.diary.body}
				>
					<LandingFeatureQuickLogVisual />
				</LandingChapter>
				<LandingChapter
					id="community"
					heading={LANDING_CHAPTER_COPY.community.heading}
					body={LANDING_CHAPTER_COPY.community.body}
				>
					<LandingFeatureRanksVisual />
				</LandingChapter>
			</main>
			<LandingFooter />
		</div>
	);
```

Remove imports for Intro, ScrollScenes, Features, Flows, Preview, `LandingPoster`. Add imports for the new modules.

- [ ] **Step 2: Run helper tests again**

Run: `cd apps/web && bun test src/app/_marketing/landing-hero-still.test.ts src/app/_marketing/landing-copy.test.ts`

Expected: PASS

- [ ] **Step 3: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: compose identity landing and slim popular fetch"
```

---

### Checkpoint: After Task 8

- [ ] Unsigned `/` renders the remake (old theater gone from the tree)
- [ ] Human visual QA before deleting files
- [ ] Human **go** for cleanup

---

### Task 9: Delete Mobbin theater + slim tokens + unused visuals

**Files:**
- Delete:
  - `apps/web/src/app/_marketing/landing-intro.tsx`
  - `apps/web/src/app/_marketing/landing-intro-scroll-chapter.tsx`
  - `apps/web/src/app/_marketing/landing-scroll-scenes.tsx`
  - `apps/web/src/app/_marketing/landing-features.tsx`
  - `apps/web/src/app/_marketing/landing-flows.tsx`
  - `apps/web/src/app/_marketing/landing-preview.tsx`
  - `apps/web/src/app/_marketing/landing-scroll-reveal.tsx`
  - `apps/web/src/app/_marketing/landing-text-box-reveal.tsx`
  - `apps/web/src/app/_marketing/landing-work-stack.tsx`
  - `apps/web/src/app/_marketing/landing-hero-preview-stage.tsx`
  - `apps/web/src/app/_marketing/landing-glass.ts`
  - `apps/web/src/app/_marketing/landing-poster.ts`
  - `apps/web/src/app/_marketing/landing-section.ts`
- Modify: `apps/web/src/app/_marketing/landing-feature-visuals.tsx` — keep only `LandingFeatureQuickLogVisual` and `LandingFeatureRanksVisual`; drop `LandingPoster` import
- Modify: `apps/web/src/app/_marketing/landing-mobbin-hero.ts` — keep only tokens still imported (`LANDING_HERO_HEADLINE_CLASS`, `LANDING_HERO_SUBLINE_CLASS`, `LANDING_HERO_CTA_*`, `LANDING_FEATURES_SECTION_TITLE_CLASS`, `LANDING_CHAPTER_*`, `LANDING_NAV_SCRIM_CLASS`, `LANDING_SKIP_LINK_CLASS`). Delete preview-well, glass-nav float, feature-well, stats, filter, pattern, split-well exports.

**Interfaces:**
- Consumes: `rg` to prove no remaining imports of deleted modules
- Produces: `_marketing/` only ships the remake

- [ ] **Step 1: Grep before delete**

Run: `rg "LandingIntro|LandingScrollScenes|LandingFeatures|LandingFlows|LandingPreview|LandingHeroPreviewStage|landing-glass|landing-poster|LANDING_VIEWPORT_SECTION|LandingFeatureAddToList|LandingFeatureReview|LandingFeatureSearch|LandingFeatureTvWatch|LandingFeatureCommunity" apps/web --glob "*.{ts,tsx}"`

Expected after Task 8: only the files about to be deleted (and unused exports inside `landing-feature-visuals.tsx`).

- [ ] **Step 2: Delete the listed files and slim the two keepers**

- [ ] **Step 3: Grep again — zero hits** except comments if any

- [ ] **Step 4: Re-run tests**

Run: `cd apps/web && bun test src/app/_marketing/landing-hero-still.test.ts src/app/_marketing/landing-copy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add -A apps/web/src/app/_marketing apps/web/src/app/page.tsx
git commit -m "chore: remove unused Mobbin landing theater"
```

---

### Checkpoint: Complete

Manual QA (spec §8):

- [ ] Unsigned `/` at ~390 and ~1440: still + Taste peek; chapters jump; CTAs in hero, nav, convert, mobile sheet
- [ ] Popular fetch failure: canvas hero, page still reads
- [ ] `prefers-reduced-motion`: Menu/Close does not animate
- [ ] Signed-in `/` → `/home` or `/onboarding`
- [ ] Skip link, focus rings, no glass, no `backdrop-blur` on the still
- [ ] No “friends”, no Contact, no Catalogue

---

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Sticky nav + 3-col grid clips chapters on mid widths | Med | `minmax(max-content,1fr)` side tracks; hide chapters below `md` |
| `LandingHero` prop change before `page.tsx` | Low | Optional `backdropUrl = null` until Task 8 |
| Deleting theater while something still imports it | High | Grep in Task 9; human QA after Task 8 |
| Secondary CTA used on `/pricing` via shared token | Low | Tokens live in landing-mobbin-hero and are landing-only today |

## Open questions

None — spec is approved. Copy tweaks wait for visual QA after Task 8.
