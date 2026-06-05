# Mobile Bottom Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a phone-only bottom tab bar (Home · Search · ＋Log · Inbox · You) with an elevated center Log button, without changing the desktop experience.

**Architecture:** A new self-contained `MobileTabBar` is mounted globally in `AppShell` and shown only below `md` (`md:hidden`). It reuses existing stores — `useCatalogSearchDialog` (Search), `useQuickLog` (center Log) — and opens a new `MobileYouSheet` bottom sheet for long-tail destinations. The dead `AppNav` component is removed; redundant global icons in the top `HomeStickyChrome` are hidden on mobile only; mobile bottom padding is added so the fixed bar never overlaps content.

**Tech Stack:** Next.js (App Router, client components), Tailwind v4, `motion/react`, zustand stores, lucide-react + `@still/ui` icons, `bun:test`.

---

## Background for the implementer

- The app's navigation is **top-anchored** today (`HomeStickyChrome` on lobby pages + per-page top bars). The bottom `AppNav` (`apps/web/src/components/app/app-nav.tsx`) is **dead code** — never rendered.
- `apps/web/src/components/app/app-shell.tsx` is the global authenticated shell; it already mounts roots like `<QuickLogRoot/>`, `<CatalogSearchDialogRoot/>`. The new bar mounts here. `AppShell` receives a `user` prop of type `AppShellUser` (`{ id, name, image, handle, email?, isPro? }`).
- **Center Log** uses the existing quick-log sheet: `useQuickLog` (zustand) — `useQuickLog((s) => s.open)` then `open()` with no args opens its built-in search-first "what did you watch?" mode. Already mounted via `<QuickLogRoot/>`.
- **Search** uses `useCatalogSearchDialog` (zustand) — `useCatalogSearchDialog((s) => s.requestOpen)` then `requestOpen()` opens the same dialog ⌘K opens.
- **Logout** mirrors the account menu: `authClient.signOut({ fetchOptions: { onSuccess: () => { router.replace("/"); router.refresh(); } } })`.
- **Breakpoint:** mobile bar shows `< md` (Tailwind `md` = 768px). Desktop is `≥ md` and must be untouched (all desktop changes are gated behind `md:`).
- Run tests from repo root: `bun test apps/web/src/components/app/<file>.test.ts`. Keep pure logic free of React/Next imports so it runs without a browser.
- Web typecheck (note: `npx tsc` inside `apps/web` is a known false-pass): `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` from repo root. There are known pre-existing baseline errors only in `apps/server/src/routes/*` (FormData) — ignore those; any error in `apps/web/src/components/app/*` or `home-sticky-chrome.tsx` is yours.

## File structure

```
apps/web/src/components/app/
  nav-user-avatar.tsx        # CREATE — NavUserAvatar moved out of app-nav.tsx
  mobile-nav.ts              # CREATE (pure) — isActive() + MOBILE_YOU_DESTINATIONS  (+ .test.ts)
  mobile-you-sheet.tsx       # CREATE — "You" hub bottom sheet
  mobile-tab-bar.tsx         # CREATE — the bottom bar
  app-shell.tsx              # MODIFY — mount <MobileTabBar/>; refresh nav docstring
  app-nav.tsx                # DELETE — dead code
apps/web/src/components/home/
  home-sticky-chrome.tsx     # MODIFY — import NavUserAvatar from new path; hide global cluster < md
packages/ui/src/styles/
  globals.css                # MODIFY — mobile bottom reserve so the bar never overlaps content
```

---

## Task 1: Extract `NavUserAvatar`; delete dead `AppNav`

**Files:**
- Create: `apps/web/src/components/app/nav-user-avatar.tsx`
- Modify: `apps/web/src/components/home/home-sticky-chrome.tsx` (import path)
- Delete: `apps/web/src/components/app/app-nav.tsx`

- [ ] **Step 1: Create the shared avatar module**

Create `apps/web/src/components/app/nav-user-avatar.tsx` (verbatim move of the `NavUserAvatar` export currently at the bottom of `app-nav.tsx`):

```tsx
import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";

/** Compact avatar — same proxy + `unoptimized` path as `ProfilePatronHeader`. */
export function NavUserAvatar({
	src,
	name,
	handle,
	size = "default",
}: {
	src: string | null;
	name: string;
	handle: string;
	/** `compact` = single `size-8` for dense header icon rows (e.g. home sticky). */
	size?: "default" | "compact";
}) {
	const frame =
		size === "compact"
			? "size-8 rounded-full text-[10px]"
			: "size-8 rounded-full text-[10px] sm:size-9";

	return (
		<PatronPortraitAvatar
			handle={handle}
			avatarUrl={src}
			name={name}
			width={72}
			height={72}
			className={frame}
		/>
	);
}
```

- [ ] **Step 2: Repoint the `home-sticky-chrome.tsx` import**

In `apps/web/src/components/home/home-sticky-chrome.tsx`, change the import:

```tsx
// FROM:
import { NavUserAvatar } from "@/components/app/app-nav";
// TO:
import { NavUserAvatar } from "@/components/app/nav-user-avatar";
```

- [ ] **Step 3: Delete the dead component**

Run:
```bash
git rm apps/web/src/components/app/app-nav.tsx
```

- [ ] **Step 4: Verify nothing else imports the deleted file**

Run: `grep -rn "components/app/app-nav" apps/web/src || echo "no references"`
Expected: `no references`.

- [ ] **Step 5: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep -E "app-nav|nav-user-avatar|home-sticky" || echo "clean"`
Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/app/nav-user-avatar.tsx apps/web/src/components/home/home-sticky-chrome.tsx
git commit -m "refactor(web): extract NavUserAvatar, remove dead AppNav"
```

---

## Task 2: Pure nav helpers (TDD)

**Files:**
- Create: `apps/web/src/components/app/mobile-nav.ts`
- Test: `apps/web/src/components/app/mobile-nav.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/app/mobile-nav.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { isActive, MOBILE_YOU_DESTINATIONS } from "./mobile-nav";

describe("isActive", () => {
	test("exact match is active", () => {
		expect(isActive("/home", "/home")).toBe(true);
		expect(isActive("/notifications", "/notifications")).toBe(true);
	});
	test("prefixed child route is active for non-home", () => {
		expect(isActive("/notifications/abc", "/notifications")).toBe(true);
	});
	test("home does NOT match other routes by prefix", () => {
		expect(isActive("/homestead", "/home")).toBe(false);
		expect(isActive("/diary", "/home")).toBe(false);
	});
	test("unrelated route is not active", () => {
		expect(isActive("/diary", "/notifications")).toBe(false);
	});
});

describe("MOBILE_YOU_DESTINATIONS", () => {
	test("lists the six long-tail destinations not in the bar", () => {
		expect(MOBILE_YOU_DESTINATIONS.map((d) => d.href)).toEqual([
			"/diary",
			"/watchlist",
			"/lists",
			"/news",
			"/chat",
			"/achievements",
		]);
	});
	test("every destination has a non-empty label", () => {
		for (const d of MOBILE_YOU_DESTINATIONS) {
			expect(d.label.length).toBeGreaterThan(0);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/components/app/mobile-nav.test.ts`
Expected: FAIL — `Cannot find module './mobile-nav'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/app/mobile-nav.ts` (no React/Next imports — stays unit-testable):

```ts
/** Active-route match for the mobile bar. Home matches only exactly; other
 *  tabs also match nested child routes (e.g. /notifications/abc). */
export function isActive(pathname: string, href: string): boolean {
	return pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`));
}

export type MobileYouDestination = { href: string; label: string };

/** Long-tail destinations surfaced in the "You" hub sheet (everything not in the bar). */
export const MOBILE_YOU_DESTINATIONS: readonly MobileYouDestination[] = [
	{ href: "/diary", label: "Diary" },
	{ href: "/watchlist", label: "Watchlist" },
	{ href: "/lists", label: "Lists" },
	{ href: "/news", label: "News" },
	{ href: "/chat", label: "Chat" },
	{ href: "/achievements", label: "Achievements" },
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/components/app/mobile-nav.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app/mobile-nav.ts apps/web/src/components/app/mobile-nav.test.ts
git commit -m "feat(web): mobile nav pure helpers (isActive + You destinations)"
```

---

## Task 3: `MobileYouSheet` (hub bottom sheet)

**Files:**
- Create: `apps/web/src/components/app/mobile-you-sheet.tsx`

- [ ] **Step 1: Implement the sheet**

Create `apps/web/src/components/app/mobile-you-sheet.tsx`:

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import IconAwardFill from "@still/ui/icons/award-fill";
import IconGear from "@still/ui/icons/gear";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	BookMarked,
	Library,
	ListMusic,
	type LucideIcon,
	MessageCircle,
	Newspaper,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AccountMenuThemePicker } from "@/components/app/account-menu-theme-picker";
import { NavUserAvatar } from "@/components/app/nav-user-avatar";
import { MOBILE_YOU_DESTINATIONS } from "@/components/app/mobile-nav";
import { authClient } from "@/lib/auth-client";

type YouUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
};

/** Icon per destination href (kept out of the pure helper module). */
const DESTINATION_ICON: Record<string, LucideIcon> = {
	"/diary": BookMarked,
	"/watchlist": ListMusic,
	"/lists": Library,
	"/news": Newspaper,
	"/chat": MessageCircle,
};

const rowClass = cn(
	"flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-base text-foreground",
	"transition-colors duration-200 ease-out [@media(hover:hover)]:hover:bg-background",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
);

export function MobileYouSheet({
	open,
	onClose,
	user,
}: {
	open: boolean;
	onClose: () => void;
	user: YouUser;
}) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();

	// Close on Escape while open.
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	const go = (path: string) => {
		onClose();
		router.push(path);
	};

	const secondaryLine = user.email?.trim() || `@${user.handle}`;

	return (
		<AnimatePresence>
			{open ? (
				<motion.div
					className="fixed inset-0 z-[60] md:hidden"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
				>
					{/* Backdrop */}
					<button
						type="button"
						aria-label="Close menu"
						className="absolute inset-0 bg-black/55 backdrop-blur-sm"
						onClick={onClose}
					/>
					{/* Panel */}
					<motion.div
						role="dialog"
						aria-label="Your account and destinations"
						aria-modal="true"
						className={cn(
							"absolute inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto rounded-t-[2rem]",
							"border-white/8 border-t bg-popover px-4 pt-3 text-popover-foreground",
							"pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(6,6,10,0.5)]",
						)}
						initial={{ y: reduceMotion ? 0 : "100%" }}
						animate={{ y: 0 }}
						exit={{ y: reduceMotion ? 0 : "100%" }}
						transition={
							reduceMotion
								? { duration: 0 }
								: { type: "tween", duration: 0.24, ease: [0.32, 0.72, 0, 1] }
						}
					>
						<div className="mx-auto mb-3 h-1 w-9 rounded-full bg-foreground/15" aria-hidden />

						{/* Identity */}
						<div className="flex items-center gap-3 px-1 pb-1">
							<NavUserAvatar src={user.image} name={user.name} handle={user.handle} />
							<div className="min-w-0 flex-1">
								<p className="truncate font-semibold text-base text-foreground">
									{user.name || "Member"}
								</p>
								<p className="truncate text-muted-foreground text-sm">{secondaryLine}</p>
							</div>
						</div>
						<button
							type="button"
							className={cn(
								"mt-3 w-full rounded-full bg-background py-3 text-center font-medium text-foreground",
								"transition-transform duration-200 active:scale-[0.98]",
							)}
							onClick={() => go(`/profile/${user.handle}`)}
						>
							View profile
						</button>

						{/* Destinations */}
						<div className="mt-3 rounded-3xl bg-background/60 p-1.5">
							{MOBILE_YOU_DESTINATIONS.map((d) => {
								const Icon =
									d.href === "/achievements" ? null : DESTINATION_ICON[d.href];
								return (
									<button
										key={d.href}
										type="button"
										className={rowClass}
										onClick={() => go(d.href)}
									>
										{d.href === "/achievements" ? (
											<IconAwardFill size="20px" className="size-5 shrink-0 opacity-90" />
										) : Icon ? (
											<Icon className="size-5 shrink-0 opacity-80" aria-hidden />
										) : null}
										{d.label}
									</button>
								);
							})}
						</div>

						{/* Theme + settings + logout */}
						<div className="mt-3 rounded-3xl bg-background/60 p-1.5">
							<AccountMenuThemePicker className="pb-1" isPro={Boolean(user.isPro)} />
							<button type="button" className={rowClass} onClick={() => go("/me/settings")}>
								<IconGear size="20px" className="size-5 shrink-0 opacity-80" />
								Settings
							</button>
						</div>

						<button
							type="button"
							className={cn(
								rowClass,
								"mt-3 justify-center bg-destructive/10 text-center font-medium text-destructive",
							)}
							onClick={() =>
								authClient.signOut({
									fetchOptions: {
										onSuccess: () => {
											onClose();
											router.replace("/");
											router.refresh();
										},
									},
								})
							}
						>
							Log out
						</button>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep "mobile-you-sheet" || echo "clean"`
Expected: `clean`. (If `Library` isn't exported by the installed lucide-react, substitute `ListChecks`; verify with `grep -o "Library" apps/web/node_modules/lucide-react/dist/lucide-react.d.ts | head -1`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app/mobile-you-sheet.tsx
git commit -m "feat(web): MobileYouSheet hub bottom sheet"
```

---

## Task 4: `MobileTabBar`

**Files:**
- Create: `apps/web/src/components/app/mobile-tab-bar.tsx`

- [ ] **Step 1: Implement the bar**

Create `apps/web/src/components/app/mobile-tab-bar.tsx`:

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { Bell, Home, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { isActive } from "@/components/app/mobile-nav";
import { MobileYouSheet } from "@/components/app/mobile-you-sheet";
import { NavUserAvatar } from "@/components/app/nav-user-avatar";
import { useCatalogSearchDialog } from "@/lib/catalog-search-dialog-store";
import { useQuickLog } from "@/components/log/quick-log-sheet";

type TabUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
};

const itemClass =
	"relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 font-medium text-[10px] transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function MobileTabBar({ user }: { user: TabUser }) {
	const pathname = usePathname();
	const reduceMotion = useReducedMotion();
	const requestCatalogSearch = useCatalogSearchDialog((s) => s.requestOpen);
	const openQuickLog = useQuickLog((s) => s.open);
	const [youOpen, setYouOpen] = useState(false);

	const homeActive = isActive(pathname, "/home");
	const inboxActive = isActive(pathname, "/notifications");

	const pip = (
		<motion.span
			layoutId="mobile-nav-active-pip"
			className="-top-0.5 absolute inset-x-3 h-0.5 rounded-full bg-accent"
			transition={
				reduceMotion
					? { duration: 0 }
					: { type: "tween", duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }
			}
		/>
	);

	return (
		<>
			<nav
				role="navigation"
				aria-label="Primary"
				className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center md:hidden"
			>
				<div className="pointer-events-auto mb-[max(0.75rem,env(safe-area-inset-bottom))] flex w-full max-w-md items-center justify-around gap-1 rounded-full border border-white/6 bg-surface-raised/72 px-2 py-1.5 shadow-[0_10px_36px_rgba(6,6,10,0.42)] backdrop-blur-xl">
					{/* Home */}
					<Link
						href="/home"
						aria-current={homeActive ? "page" : undefined}
						className={cn(itemClass, homeActive ? "text-foreground" : "text-muted-foreground")}
					>
						{homeActive ? pip : null}
						<Home className="size-5" aria-hidden />
						Home
					</Link>

					{/* Search */}
					<button
						type="button"
						className={cn(itemClass, "text-muted-foreground")}
						onClick={() => requestCatalogSearch()}
						aria-label="Search films, TV, and people"
					>
						<Search className="size-5" aria-hidden />
						Search
					</button>

					{/* Center: Log */}
					<button
						type="button"
						className="-mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_8px_20px_rgba(224,179,65,0.45)] transition-transform duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
						onClick={() => openQuickLog()}
						aria-label="Log a film"
					>
						<Plus className="size-7" aria-hidden />
					</button>

					{/* Inbox */}
					<Link
						href="/notifications"
						aria-current={inboxActive ? "page" : undefined}
						className={cn(itemClass, inboxActive ? "text-foreground" : "text-muted-foreground")}
					>
						{inboxActive ? pip : null}
						<Bell className="size-5" aria-hidden />
						Inbox
					</Link>

					{/* You */}
					<button
						type="button"
						className={cn(itemClass, youOpen ? "text-foreground" : "text-muted-foreground")}
						onClick={() => setYouOpen(true)}
						aria-haspopup="dialog"
						aria-expanded={youOpen}
						aria-label="Your account and destinations"
					>
						<span className="flex size-5 items-center justify-center">
							<NavUserAvatar
								src={user.image}
								name={user.name}
								handle={user.handle}
								size="compact"
							/>
						</span>
						You
					</button>
				</div>
			</nav>

			<MobileYouSheet open={youOpen} onClose={() => setYouOpen(false)} user={user} />
		</>
	);
}
```

> Note: `NavUserAvatar` `compact` renders `size-8`; it's wrapped in a `size-5` box here for tab density — acceptable since it scales within the row. If it looks oversized in preview, render a `User` lucide icon instead. The `bg-accent`/`text-accent-foreground`/`bg-surface-raised` tokens are existing Aker tokens (used by the old AppNav and buttons).

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep "mobile-tab-bar" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app/mobile-tab-bar.tsx
git commit -m "feat(web): MobileTabBar bottom bar with center Log"
```

---

## Task 5: Mount in `AppShell` + refresh docstring

**Files:**
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Import and mount the bar**

In `apps/web/src/components/app/app-shell.tsx`, add the import near the other `@/components/app` imports:

```tsx
import { MobileTabBar } from "@/components/app/mobile-tab-bar";
```

Then mount it inside the shell `div`, immediately after `<BadgeWatcher />` (so it sits above page content as a fixed overlay):

```tsx
			<BadgeWatcher />
			<MobileTabBar
				user={{
					id: user.id,
					name: user.name,
					image: user.image,
					handle: user.handle,
					email: user.email,
					isPro: user.isPro,
				}}
			/>
		</div>
```

- [ ] **Step 2: Refresh the stale navigation docstring**

In the same file, replace the now-inaccurate `AppNav` "Navigation contract (MVP)" docstring block at the top of the file with:

```tsx
/**
 * Track B — authenticated app chrome (single shell for `(app)` routes).
 *
 * **Navigation:** top chrome is page-owned (`HomeStickyChrome` on lobby pages,
 * per-page top bars elsewhere). On phones (`< md`) a global `MobileTabBar`
 * (Home · Search · ＋Log · Inbox · You) is fixed to the bottom; it is hidden at
 * `md+` where the top chrome is the full navigation. The center ＋Log opens the
 * quick-log sheet; Search opens the catalog dialog; You opens a hub sheet.
 *
 * **Landmarks:** `MobileTabBar` exposes a `navigation`; each route's content
 * owns one `main`. Grain / projector boot are `aria-hidden` where applicable.
 *
 * **Gutters:** horizontal page padding lives only on the inner wrapper below
 * `CinemaSceneCut`; routes that need full-bleed heroes manage their own edge
 * breakout inside `children`. Mobile bottom inset for the bar lives in
 * `packages/ui/src/styles/globals.css` (`#main-content`).
 */
```

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep "app-shell" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app/app-shell.tsx
git commit -m "feat(web): mount MobileTabBar in AppShell"
```

---

## Task 6: Hide redundant top-chrome cluster on mobile

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-chrome.tsx`

- [ ] **Step 1: Gate the right-side global cluster behind `md`**

In `apps/web/src/components/home/home-sticky-chrome.tsx`, find the right-cluster wrapper (the `<div>` that contains the `TooltipProvider` with watchlist/lists/diary shortcuts + notifications + avatar):

```tsx
// FROM:
				<div className="flex min-w-0 shrink-0 justify-center sm:justify-end">
// TO:
				<div className="hidden min-w-0 shrink-0 justify-center sm:justify-end md:flex">
```

This hides the cluster `< md` (the `MobileTabBar` owns Home/Search/Inbox/You there) and restores it unchanged at `md+`. Do not touch the browse-tabs block or the search block — those stay on mobile.

- [ ] **Step 2: Verify only one wrapper changed**

Run: `grep -n "hidden min-w-0 shrink-0 justify-center sm:justify-end md:flex" apps/web/src/components/home/home-sticky-chrome.tsx`
Expected: exactly one match.

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep "home-sticky" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/home/home-sticky-chrome.tsx
git commit -m "feat(web): hide redundant top-chrome cluster on mobile"
```

---

## Task 7: Mobile bottom reserve (no overlap)

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

- [ ] **Step 1: Add a mobile-only bottom reserve to `#main-content`**

In `packages/ui/src/styles/globals.css`, find:

```css
	#main-content {
		padding-bottom: 10px;
	}
```

Replace with (keeps the 10px desktop reserve, adds clearance for the bar `< md` — bar height ~3.5rem + lift + margin + safe area):

```css
	#main-content {
		padding-bottom: 10px;
	}
	/* Mobile bottom bar (MobileTabBar) is fixed; reserve space so it never
	   overlaps content / empty states. Desktop (>= md, 768px) keeps 10px. */
	@media (max-width: 767.98px) {
		#main-content {
			padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
		}
	}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "feat(web): reserve mobile bottom space for the tab bar"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the web unit suite for the nav helper**

Run: `bun test apps/web/src/components/app/mobile-nav.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 2: Full web typecheck (only baseline server errors allowed)**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep -v "apps/server/src/routes" | grep "error" || echo "no web errors"`
Expected: `no web errors`.

- [ ] **Step 3: Mobile preview check (375px)**

With the web preview running and signed in, at 375px confirm:
- Bottom bar is visible: Home · Search · ＋Log · Inbox · You.
- Center ＋Log opens the quick-log sheet (search-first).
- Search opens the catalog search dialog.
- Inbox routes to `/notifications` (tab shows active there).
- "You" opens the hub sheet listing Diary, Watchlist, Lists, News, Chat, Achievements, View profile, theme picker, Settings, Log out; backdrop/Escape closes it.
- On `/home` and `/diary`, the top-chrome's right icon cluster is gone (no duplicate bell/avatar), browse tabs + search remain.
- No content/empty-state is hidden behind the bar (scroll to the bottom of `/home`).

- [ ] **Step 4: Desktop preview check (≥768px)**

At 1280px confirm:
- The bottom bar is hidden.
- `HomeStickyChrome` shows the full right cluster (watchlist/lists/diary/bell/avatar) exactly as before.
- Bottom content reserve is back to the original 10px (no large gap).

- [ ] **Step 5: Final commit (if any preview-driven tweaks were made)**

```bash
git add -A
git commit -m "fix(web): mobile tab bar preview adjustments"
```
(Skip if Steps 3–4 needed no changes.)

---

## Done

The app now has a phone-only bottom tab bar with a prominent center Log action, a "You" hub for everything else, and zero changes to the desktop experience. Verified by unit tests (route matcher + destination list), a clean web typecheck, and preview checks at 375px and 1280px.
```
