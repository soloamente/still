import { type CSSProperties, type ReactNode, Suspense } from "react";
import { AppScrollToTop } from "@/components/app/app-scroll-to-top";
import { CommandPaletteRoot } from "@/components/app/command-palette";
import { DetailReturnCapture } from "@/components/app/detail-return-capture";
import { BadgeWatcher } from "@/components/gamification/badge-watcher";
import { CatalogSearchDialogRoot } from "@/components/home/home-sticky-search";
import { QuickLogRoot } from "@/components/log/quick-log-sheet";
import { PersonFilmographyDrawerRoot } from "@/components/movie/person-filmography-drawer";
import { ReviewComposerRoot } from "@/components/review/review-composer";
import { ReviewDetailRoot } from "@/components/review/review-detail-sheet";

/**
 * Track B — authenticated app chrome (single shell for `(app)` routes).
 *
 * **Navigation contract (MVP):** floating **bottom** bar (`AppNav`) — icon + short
 * label, `min-h-11` tap targets; wordmark from `sm`; search opens ⌘K catalog sheet;
 * overflow menu for Lists / Achievements; **notifications bell** in the bar on **all** breakpoints (Track B nav parity, 2026-05-14). There is **no** left rail → drawer
 * breakpoint: the bar stays bottom-anchored at all widths.
 *
 * **Landmarks:** this tree exposes one `navigation` (inside `AppNav`) and one
 * `main` for primary content. Grain / projector boot are `aria-hidden` where
 * applicable.
 *
 * **Gutters:** horizontal page padding lives only on the inner wrapper below
 * `CinemaSceneCut`; routes that need full-bleed heroes manage their own edge
 * breakout inside `children`.
 */
export type AppShellUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
};

/**
 * Bottom inset under scrollable content — literal must match `#main-content`
 * `padding-bottom` in `packages/ui/src/styles/globals.css` (single source for shell spacing).
 */
export const APP_SHELL_BOTTOM_RESERVE_CSS = "10px";

/** Use on sparse pages (e.g. person detail) to vertically center in the viewport minus the nav. */
export const appShellMainContentMinHeightStyle: CSSProperties = {
	minHeight: `calc(100svh - ${APP_SHELL_BOTTOM_RESERVE_CSS})`,
};

export function AppShell({
	user: _user,
	children,
}: {
	user: AppShellUser;
	children: ReactNode;
}) {
	return (
		<div className="relative flex min-h-svh flex-col bg-background">
			<Suspense fallback={null}>
				<DetailReturnCapture />
			</Suspense>
			{/*
				`min-h-svh` gives `<main>` a definite block axis so `flex-1` children (e.g. `/home`)
				fill the **content** box; bottom padding lives in `globals.css` `#main-content`
				(same literal as `APP_SHELL_BOTTOM_RESERVE_CSS`) so it cannot be lost to RSC style quirks.
			*/}
			<main
				id="main-content"
				className="relative z-[36] flex min-h-svh flex-1 flex-col px-2.5 pt-0"
			>
				{children}
			</main>
			<AppScrollToTop />
			<CatalogSearchDialogRoot />
			<CommandPaletteRoot />
			<QuickLogRoot />
			<ReviewComposerRoot />
			<ReviewDetailRoot />
			<PersonFilmographyDrawerRoot />
			<BadgeWatcher />
		</div>
	);
}
