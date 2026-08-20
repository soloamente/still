# Landing Mobbin-grammar amendment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Human **go** between tasks. One task per subagent.

**Goal:** Replace the cinematic still + three chapter cards on unsigned `/` with Mobbin grammar in Sense chrome: type hero, product well, one Taste · Diary · Community tab band, then convert.

**Architecture:** TDD the poster picker and copy contract first. Then presentational well + type hero, slim nav, client product tabs, compose `page.tsx`, delete unused theater/chapter/backdrop code. Convert band stays as shipped.

**Tech Stack:** Next.js App Router, React 19, `next/image`, `SegmentedPillToolbar` (`motion/react` inside it), Tailwind, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-08-14-landing-page-remake-design.md` (amended 2026-08-14)

## Global Constraints

- Product name is **Sense**. Packages stay `@still/*`.
- Motion imports are `motion/react`, never `framer-motion`.
- Sentence case. No “friends”. Diary copy says **cinema** / **at home**, never **In cinemas**.
- No decorative borders, rings, or box-shadows. Surface depth only (`bg-background` → `bg-card` → inset `bg-background`).
- No scroll-hijack, parallax, fade-up-on-scroll, Ken Burns, trailer, still slideshow, or full-bleed movie backdrop.
- No fake stats, logo strips, or testimonials.
- Do not put `data-lenis-prevent-wheel` on the product well or tab panels.
- Do not change signed-in `/` redirect. Do not change global `APP_METADATA_DESCRIPTION`.
- `font-sans` only — no Fraunces `font-display` on this page.
- CTAs: **Create account** → `/sign-up`, **Sign in** → `/sign-in`. Hits ≥ 44px (`h-11`).
- Comments explain why. Do not delete old comments unless the code they describe is gone.
- TDD on pure helpers. Run `cd apps/web && bun test <file>` — expect FAIL then PASS.
- Commit only if the human asked this session; otherwise leave the working tree uncommitted and skip each Commit step.
- Touch only landing-remake files. Do not start unrelated Settings/Pricing work.

---

## File map

| File | Role |
| --- | --- |
| `apps/web/src/app/_marketing/landing-hero-still.ts` | `pickLandingHeroPosters` (replace backdrop helper) |
| `apps/web/src/app/_marketing/landing-hero-still.test.ts` | Empty / skip / cap-at-8 |
| `apps/web/src/app/_marketing/landing-copy.ts` | Tabs (no hrefs), product `h2`, browse pills |
| `apps/web/src/app/_marketing/landing-copy.test.ts` | Tab ids, convert, no friends, product heading |
| `apps/web/src/app/_marketing/landing-hero-well.tsx` | Static lobby chrome + poster grid |
| `apps/web/src/app/_marketing/landing-hero.tsx` | `#scene` type + CTAs + well |
| `apps/web/src/app/_marketing/landing-nav.tsx` | Wordmark + Sign in + Create account |
| `apps/web/src/app/_marketing/landing-product.tsx` | `#product` tabs + specimen |
| `apps/web/src/app/_marketing/landing-footer.tsx` | Convert + Pricing/Changelog/Sign in (no chapter anchors) |
| `apps/web/src/app/page.tsx` | Compose; slim popular fetch to posters |
| Delete list | Task 8 |

---

### Task 1: `pickLandingHeroPosters`

**Files:**
- Modify: `apps/web/src/app/_marketing/landing-hero-still.test.ts`
- Modify: `apps/web/src/app/_marketing/landing-hero-still.ts`

**Interfaces:**
- Consumes: popular-movies rows with optional `poster_url` and `title`
- Produces: `pickLandingHeroPosters(results, limit?) => LandingHeroPoster[]` and `LandingHeroPoster` / `LandingHeroPosterSource`

- [ ] **Step 1: Write the failing test**

Replace `landing-hero-still.test.ts` entirely:

```ts
import { describe, expect, test } from "bun:test";

import { pickLandingHeroPosters } from "./landing-hero-still";

describe("pickLandingHeroPosters", () => {
	test("returns empty for empty or missing lists", () => {
		expect(pickLandingHeroPosters(null)).toEqual([]);
		expect(pickLandingHeroPosters(undefined)).toEqual([]);
		expect(pickLandingHeroPosters([])).toEqual([]);
	});

	test("skips rows without a poster and caps at the limit", () => {
		expect(
			pickLandingHeroPosters(
				[
					{ poster_url: null, title: "Skip" },
					{ poster_url: "   ", title: "Blank" },
					{
						poster_url: "https://image.tmdb.org/t/p/w342/a.jpg",
						title: "A",
					},
					{
						poster_url: "https://image.tmdb.org/t/p/w342/b.jpg",
						title: "B",
					},
					{
						poster_url: "https://image.tmdb.org/t/p/w342/c.jpg",
					},
				],
				2,
			),
		).toEqual([
			{
				posterUrl: "https://image.tmdb.org/t/p/w342/a.jpg",
				title: "A",
			},
			{
				posterUrl: "https://image.tmdb.org/t/p/w342/b.jpg",
				title: "B",
			},
		]);
	});

	test("defaults the cap to 8", () => {
		const rows = Array.from({ length: 10 }, (_, index) => ({
			poster_url: `https://image.tmdb.org/t/p/w342/${index}.jpg`,
			title: `T${index}`,
		}));
		expect(pickLandingHeroPosters(rows)).toHaveLength(8);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/app/_marketing/landing-hero-still.test.ts`

Expected: FAIL (`pickLandingHeroPosters` is not exported)

- [ ] **Step 3: Write minimal implementation**

Replace `landing-hero-still.ts` entirely. Do not keep `pickLandingHeroBackdrop` (nothing should import it after Task 7; Task 8 greps to confirm).

```ts
/** Popular-list row — only the poster fields the landing hero well reads. */
export interface LandingHeroPosterSource {
	poster_url?: string | null;
	title?: string | null;
}

export interface LandingHeroPoster {
	posterUrl: string;
	title: string;
}

const DEFAULT_HERO_POSTER_LIMIT = 8;

/** Up to `limit` posters with a non-empty URL. Never use backdrops. */
export function pickLandingHeroPosters(
	results:
		| readonly (LandingHeroPosterSource | null | undefined)[]
		| null
		| undefined,
	limit = DEFAULT_HERO_POSTER_LIMIT,
): LandingHeroPoster[] {
	if (!results?.length || limit <= 0) return [];
	const picked: LandingHeroPoster[] = [];
	for (const row of results) {
		const posterUrl = row?.poster_url?.trim();
		if (!posterUrl) continue;
		picked.push({
			posterUrl,
			title: row?.title?.trim() ?? "",
		});
		if (picked.length >= limit) break;
	}
	return picked;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/app/_marketing/landing-hero-still.test.ts`

Expected: PASS (3 tests)

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-hero-still.ts apps/web/src/app/_marketing/landing-hero-still.test.ts
git commit -m "feat: pick landing hero posters for the product well"
```

---

### Task 2: Copy contract for tabs + product heading

**Files:**
- Modify: `apps/web/src/app/_marketing/landing-copy.test.ts`
- Modify: `apps/web/src/app/_marketing/landing-copy.ts`

**Interfaces:**
- Consumes: existing hero/convert/CTA/footer strings (keep)
- Produces: `LANDING_CHAPTERS` as `{ id, label }[]` (no `href`); `LandingProductTabId`; `LANDING_PRODUCT_HEADING`; `LANDING_HERO_BROWSE`

- [ ] **Step 1: Write the failing test**

Replace the first test in `landing-copy.test.ts` and add the product-heading assertion. Import `LANDING_PRODUCT_HEADING` and `LANDING_HERO_BROWSE`.

```ts
import { describe, expect, test } from "bun:test";

import {
	LANDING_CHAPTER_COPY,
	LANDING_CHAPTERS,
	LANDING_CONVERT_COPY,
	LANDING_CTA,
	LANDING_FOOTER_LINKS,
	LANDING_HERO_BROWSE,
	LANDING_METADATA_DESCRIPTION,
	LANDING_PRODUCT_HEADING,
	LANDING_SKIP_HREF,
} from "./landing-copy";

describe("landing copy contract", () => {
	test("product tabs match Taste Diary Community ids", () => {
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
		expect(LANDING_PRODUCT_HEADING).toBe("How Sense works.");
		expect(LANDING_HERO_BROWSE.map((pill) => pill.label)).toEqual([
			"Movies",
			"TV",
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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/app/_marketing/landing-copy.test.ts`

Expected: FAIL (`LANDING_PRODUCT_HEADING` / `LANDING_HERO_BROWSE` missing, or chapters still have `href`)

- [ ] **Step 3: Write minimal implementation**

In `landing-copy.ts`:

- Replace `LANDING_CHAPTERS` with id/label only (drop `href`).
- Export `LandingProductTabId`.
- Add `LANDING_PRODUCT_HEADING` and `LANDING_HERO_BROWSE`.
- Keep every other export unchanged (hero copy, CTAs, chapter bodies, convert, footer links, taste specimen, skip, metadata).

```ts
export const LANDING_CHAPTERS = [
	{ id: "taste", label: "Taste" },
	{ id: "diary", label: "Diary" },
	{ id: "community", label: "Community" },
] as const;

export type LandingProductTabId = (typeof LANDING_CHAPTERS)[number]["id"];

export const LANDING_PRODUCT_HEADING = "How Sense works.";

/** Decorative lobby browse pills inside the hero well — Movies is the active face. */
export const LANDING_HERO_BROWSE = [
	{ id: "movies", label: "Movies" },
	{ id: "tv", label: "TV" },
	{ id: "community", label: "Community" },
] as const;
```

If `landing-nav.tsx` or `landing-footer.tsx` typecheck-fail because they still read `chapter.href`, leave them until Tasks 5–6 — this task only changes copy + tests. Do not “fix” nav/footer here.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/app/_marketing/landing-copy.test.ts src/app/_marketing/landing-hero-still.test.ts`

Expected: PASS (copy 3 + posters 3)

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-copy.ts apps/web/src/app/_marketing/landing-copy.test.ts
git commit -m "feat: landing copy for product tabs and hero browse pills"
```

---

### Task 3: Hero product well

**Files:**
- Create: `apps/web/src/app/_marketing/landing-hero-well.tsx`

**Interfaces:**
- Consumes: `LandingHeroPoster[]` from Task 1; `LANDING_HERO_BROWSE` from Task 2; `LANDING_CHAPTER_CARD_CLASS` / `LANDING_CHAPTER_WELL_CLASS`; `HOME_LOBBY_CHIP_TRACK_CLASSNAME`
- Produces: `LandingHeroWell({ posters })` — decorative, `aria-hidden`

- [ ] **Step 1: Create the well**

No unit test (presentational). Implement:

```tsx
import Image from "next/image";

import { HOME_LOBBY_CHIP_TRACK_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

import { LANDING_HERO_BROWSE } from "./landing-copy";
import type { LandingHeroPoster } from "./landing-hero-still";
import {
	LANDING_CHAPTER_CARD_CLASS,
	LANDING_CHAPTER_WELL_CLASS,
} from "./landing-mobbin-hero";

/** Static lobby chrome + poster tiles — product shot, not a cinematic still. */
export function LandingHeroWell({
	posters,
}: {
	posters: readonly LandingHeroPoster[];
}) {
	return (
		<div
			className={`mx-auto mt-10 w-full max-w-mobbin-page ${LANDING_CHAPTER_CARD_CLASS}`}
			aria-hidden
		>
			<div className={`${LANDING_CHAPTER_WELL_CLASS} flex-col gap-4 sm:p-6`}>
				<div className={HOME_LOBBY_CHIP_TRACK_CLASSNAME}>
					{LANDING_HERO_BROWSE.map((pill, index) => (
						<span
							key={pill.id}
							className={
								index === 0
									? "inline-flex min-h-10 items-center rounded-full bg-card px-5 py-2.5 font-medium font-sans text-foreground text-sm"
									: "inline-flex min-h-10 items-center rounded-full px-5 py-2.5 font-medium font-sans text-muted-foreground text-sm"
							}
						>
							{pill.label}
						</span>
					))}
				</div>
				{posters.length > 0 ? (
					<div className="grid w-full grid-cols-4 gap-2 sm:grid-cols-4">
						{posters.map((poster) => (
							<div
								key={poster.posterUrl}
								className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted/30"
							>
								<Image
									src={poster.posterUrl}
									alt=""
									fill
									sizes="12vw"
									className="object-cover"
								/>
							</div>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
```

Why `aria-hidden` on the whole well: spec — decorative specimen, not live catalogue. Why `alt=""`: decorative posters. Why no `Link` / RadialToolkit: not live. Why empty grid omitted: chrome still reads when popular fetch fails.

- [ ] **Step 2: Typecheck the new file in your head / editor** — `LandingHeroPoster` must match Task 1. Do not mount it yet (Task 4).

- [ ] **Step 3: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-hero-well.tsx
git commit -m "feat: landing hero product well"
```

---

### Task 4: Type hero (`#scene`)

**Files:**
- Modify: `apps/web/src/app/_marketing/landing-hero.tsx`

**Interfaces:**
- Consumes: `LandingHeroWell`; `posters: LandingHeroPoster[]`; existing `LANDING_HERO_COPY` / CTA tokens
- Produces: `LandingHero({ posters })` — no `backdropUrl`, no scrims, no `min-h-dvh`

- [ ] **Step 1: Rewrite `landing-hero.tsx`**

Replace the file. Drop `next/image` from this file (the well owns images). Drop both scrim class constants.

```tsx
import Link from "next/link";

import { LANDING_CTA, LANDING_HERO_COPY } from "./landing-copy";
import { LandingHeroWell } from "./landing-hero-well";
import type { LandingHeroPoster } from "./landing-hero-still";
import {
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_ROW_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
	LANDING_HERO_HEADLINE_CLASS,
	LANDING_HERO_SUBLINE_CLASS,
} from "./landing-mobbin-hero";

/**
 * Identity hero — type + CTAs + product well. Content-height, not a locked still.
 */
export function LandingHero({
	posters,
}: {
	posters: readonly LandingHeroPoster[];
}) {
	return (
		<section
			id="scene"
			className="w-full bg-background px-4 py-16 sm:px-6 sm:py-24"
		>
			<div className="mx-auto flex w-full max-w-mobbin-page flex-col items-center text-center">
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
			<LandingHeroWell posters={posters} />
		</section>
	);
}
```

`page.tsx` will still pass `backdropUrl` until Task 7 — that is expected. Do not edit `page.tsx` in this task.

- [ ] **Step 2: Confirm no still/scrim strings remain in `landing-hero.tsx`**

Grep this file for `backdrop`, `min-h-[calc(100dvh`, `HERO_TOP_SCRIM`, `object-cover`. Expected: zero hits.

- [ ] **Step 3: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-hero.tsx
git commit -m "feat: landing type hero with product well"
```

---

### Task 5: Slim nav

**Files:**
- Modify: `apps/web/src/app/_marketing/landing-nav.tsx`

**Interfaces:**
- Consumes: `LANDING_CTA`, `LandingMarkPill`, CTA class tokens, `LANDING_NAV_SCRIM_CLASS`
- Produces: sticky bar — wordmark left, Sign in + Create account right, all widths. No chapters. No mobile sheet.

- [ ] **Step 1: Rewrite `landing-nav.tsx`**

Drop `LANDING_CHAPTERS`, `useTextStateSwap`, Menu/Close, the sheet, and `z-[60]`. Keep scroll scrim after `scrollY > 2`.

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LANDING_CTA } from "./landing-copy";
import {
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
	LANDING_NAV_SCRIM_CLASS,
} from "./landing-mobbin-hero";
import { LandingMarkPill } from "./landing-mark-pill";

export function LandingNav({ className }: { className?: string }) {
	const [isScrolled, setIsScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			setIsScrolled(window.scrollY > 2);
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			className={cn(
				"sticky top-0 z-40 w-full",
				LANDING_NAV_SCRIM_CLASS,
				isScrolled && "after:opacity-100",
				className,
			)}
		>
			<div className="mx-auto flex w-full max-w-mobbin-page items-center justify-between gap-3 px-4 py-3 sm:px-6">
				<LandingMarkPill />
				<div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
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
			</div>
		</header>
	);
}
```

Why no hamburger: spec — nav is wordmark + two CTAs at every width.

- [ ] **Step 2: Grep `landing-nav.tsx` for `LANDING_CHAPTERS`, `Menu`, `useTextStateSwap`, `landing-mobile-menu`**

Expected: zero hits.

- [ ] **Step 3: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-nav.tsx
git commit -m "feat: landing nav without chapter links or mobile sheet"
```

---

### Task 6: Product band + footer without chapter anchors

**Files:**
- Create: `apps/web/src/app/_marketing/landing-product.tsx`
- Modify: `apps/web/src/app/_marketing/landing-footer.tsx`

**Interfaces:**
- Consumes: `LANDING_CHAPTERS`, `LandingProductTabId`, `LANDING_CHAPTER_COPY`, `LANDING_PRODUCT_HEADING`, `SegmentedPillToolbar`, `LandingTasteVisual`, `LandingFeatureQuickLogVisual`, `LandingFeatureRanksVisual`, chapter card tokens, `LANDING_FEATURES_SECTION_TITLE_CLASS`
- Produces: `LandingProduct` client section `#product`; footer links = Pricing · Changelog · Sign in only

- [ ] **Step 1: Create `landing-product.tsx`**

```tsx
"use client";

import { useState } from "react";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";

import {
	LANDING_CHAPTER_COPY,
	LANDING_CHAPTERS,
	LANDING_PRODUCT_HEADING,
	type LandingProductTabId,
} from "./landing-copy";
import {
	LandingFeatureQuickLogVisual,
	LandingFeatureRanksVisual,
} from "./landing-feature-visuals";
import {
	LANDING_CHAPTER_CARD_CLASS,
	LANDING_CHAPTER_WELL_CLASS,
	LANDING_FEATURES_SECTION_TITLE_CLASS,
} from "./landing-mobbin-hero";
import { LandingTasteVisual } from "./landing-taste-visual";

function LandingProductSpecimen({ tab }: { tab: LandingProductTabId }) {
	switch (tab) {
		case "taste":
			return <LandingTasteVisual />;
		case "diary":
			return <LandingFeatureQuickLogVisual />;
		case "community":
			return <LandingFeatureRanksVisual />;
		default: {
			const _never: never = tab;
			return _never;
		}
	}
}

export function LandingProduct() {
	const [tab, setTab] = useState<LandingProductTabId>("taste");

	return (
		<section
			id="product"
			className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24"
		>
			<div className="mx-auto flex w-full max-w-mobbin-page flex-col items-center">
				<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
					{LANDING_PRODUCT_HEADING}
				</h2>
				<div className="mt-8">
					<SegmentedPillToolbar
						layoutId="landing-product-tab"
						aria-label="How Sense works"
						value={tab}
						onChange={setTab}
						options={LANDING_CHAPTERS}
					/>
				</div>
				<p className="mt-6 max-w-md text-pretty text-center font-sans text-muted-foreground text-sm leading-relaxed sm:text-base">
					{LANDING_CHAPTER_COPY[tab].body}
				</p>
				<div
					className={`mt-10 w-full ${LANDING_CHAPTER_CARD_CLASS}`}
				>
					<div className={LANDING_CHAPTER_WELL_CLASS}>
						<LandingProductSpecimen tab={tab} />
					</div>
				</div>
			</div>
		</section>
	);
}
```

Why client: tab state. Why default Taste: spec. Why no hash: YAGNI. Why exhaustive `never`: new tab ids must fail compile.

Do not mount `LandingProduct` in `page.tsx` yet (Task 7).

- [ ] **Step 2: Slim `landing-footer.tsx`**

Remove the `LANDING_CHAPTERS` import and the chapter `<ul>`. Keep convert, wordmark, `LANDING_FOOTER_LINKS`, copyright. No `border-t`.

```tsx
import Link from "next/link";

import { APP_NAME } from "@/lib/app-brand";

import { LANDING_FOOTER_LINKS } from "./landing-copy";
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

- [ ] **Step 3: Grep `landing-footer.tsx` for `LANDING_CHAPTERS` / `#taste`**

Expected: zero hits.

- [ ] **Step 4: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/_marketing/landing-product.tsx apps/web/src/app/_marketing/landing-footer.tsx
git commit -m "feat: landing product tabs and footer without chapter anchors"
```

---

### Task 7: Compose `/`

**Files:**
- Modify: `apps/web/src/app/page.tsx` only

**Interfaces:**
- Consumes: `pickLandingHeroPosters`, `LandingHero`, `LandingProduct`, existing skip/nav/footer/metadata/auth
- Produces: skip → nav → `#scene` → `#product` → footer. No chapters. No backdrop.

- [ ] **Step 1: Rewrite the page body and fetch**

Keep `generateMetadata`, `dynamic = "force-dynamic"`, `authServer` / onboarding → `/home` exactly as they are.

Replace the popular fetch + JSX:

```tsx
	const api = await serverApi();
	const popular = await api.api.movies.popular
		.get()
		.catch(() => ({ data: null }));
	const posters = pickLandingHeroPosters(
		(
			popular.data as {
				results?: { poster_url?: string | null; title?: string | null }[];
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
				<LandingHero posters={posters} />
				<LandingProduct />
			</main>
			<LandingFooter />
		</div>
	);
```

Imports to keep: metadata/auth/OG/onboarding/`serverApi`/`getSiteOrigin`, `LANDING_METADATA_DESCRIPTION`, `LANDING_SKIP_HREF`, `LANDING_SKIP_LINK_CLASS`, `LandingFooter`, `LandingHero`, `LandingNav`.

Imports to add: `pickLandingHeroPosters` from `./_marketing/landing-hero-still`, `LandingProduct` from `./_marketing/landing-product`.

Imports to remove: `LandingChapter`, `LANDING_CHAPTER_COPY`, feature visuals, `LandingTasteVisual`, `pickLandingHeroBackdrop`.

- [ ] **Step 2: Run helper tests**

Run: `cd apps/web && bun test src/app/_marketing/landing-hero-still.test.ts src/app/_marketing/landing-copy.test.ts`

Expected: PASS

- [ ] **Step 3: Commit** (skip unless the human asked)

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: compose landing as type hero and product tabs"
```

---

### Task 8: Delete unused theater, chapter, and backdrop leftovers

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
  - `apps/web/src/app/_marketing/landing-chapter.tsx`
- Modify: `apps/web/src/app/_marketing/landing-feature-visuals.tsx` — keep only `LandingFeatureQuickLogVisual` and `LandingFeatureRanksVisual`; drop `LandingPoster` import and unused visuals (`LandingFeatureAddToList`, review, search, TV watch, community extra if present)
- Modify: `apps/web/src/app/_marketing/landing-mobbin-hero.ts` — keep only tokens still imported: `LANDING_HERO_HEADLINE_CLASS`, `LANDING_HERO_SUBLINE_CLASS`, `LANDING_HERO_CTA_*`, `LANDING_FEATURES_SECTION_TITLE_CLASS`, `LANDING_CHAPTER_CARD_CLASS`, `LANDING_CHAPTER_WELL_CLASS`, `LANDING_NAV_SCRIM_CLASS`, `LANDING_SKIP_LINK_CLASS`. Delete preview-well, glass-nav float, feature-well, stats, filter, pattern, split-well, `LANDING_HERO_SECTION_CLASS` if unused.

**Interfaces:**
- Consumes: `rg` to prove no remaining imports of deleted modules
- Produces: `_marketing/` only ships the remake

- [x] **Step 1: Grep before delete**

Run (PowerShell-safe): from repo root, search `apps/web` for:

`LandingIntro|LandingScrollScenes|LandingFeatures|LandingFlows|LandingPreview|LandingHeroPreviewStage|landing-glass|landing-poster|LANDING_VIEWPORT_SECTION|LandingChapter|pickLandingHeroBackdrop|LandingFeatureAddToList|LandingFeatureReview|LandingFeatureSearch|LandingFeatureTvWatch`

Expected after Task 7: only the files about to be deleted (and unused exports inside `landing-feature-visuals.tsx` / `landing-mobbin-hero.ts`).

- [x] **Step 2: Delete the listed files and slim the two keepers**

If `landing-feature-visuals.tsx` still imports `LandingPoster` only for unused visuals, remove those exports and the import. Do not restyle Quick Log / ranks in this task.

- [x] **Step 3: Grep again — zero hits** except comments if any

- [x] **Step 4: Re-run tests**

Run: `cd apps/web && bun test src/app/_marketing/landing-hero-still.test.ts src/app/_marketing/landing-copy.test.ts`

Expected: PASS

- [x] **Step 5: Commit** (skipped — human did not ask)

```bash
git add -A apps/web/src/app/_marketing apps/web/src/app/page.tsx
git commit -m "chore: remove unused landing theater and chapter cards"
```

---

### Checkpoint: Complete

Manual QA (spec §8):

- [ ] Unsigned `/` at ~390 and ~1440: type hero + product well in the first viewport; no full-bleed still; tabs swap Taste / Diary / Community
- [ ] Popular fetch failure: chrome well, page still reads
- [ ] `prefers-reduced-motion`: tab pill does not animate
- [ ] Signed-in `/` → `/home` or `/onboarding`
- [ ] Skip link, focus rings, no glass, no Contact, no Catalogue, no “friends”

---

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Task 2 breaks nav/footer types (`chapter.href`) | Low | Tasks 5–6 rewrite those files; do not “fix” them in Task 2 |
| Poster tiles feel cinematic | Med | Contained in raised well; not full-bleed; QA after Task 7 |
| Deleting theater while something still imports it | High | Grep in Task 8 after compose |

## Open questions

None — spec is approved. Copy tweaks wait for visual QA after Task 7.
