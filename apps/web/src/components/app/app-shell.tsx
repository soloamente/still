import { type CSSProperties, type ReactNode, Suspense } from "react";
import { AppScrollToTop } from "@/components/app/app-scroll-to-top";
import { DetailReturnCapture } from "@/components/app/detail-return-capture";
import { GoToDialogRoot } from "@/components/app/go-to-dialog-root";
import { MobileTabBar } from "@/components/app/mobile-tab-bar";
import { SoftwareGpuDocumentProbe } from "@/components/app/software-gpu-document-probe";
import { WhatsNewDialogRoot } from "@/components/app/whats-new-dialog-root";
import { CatalogSearchDialogRoot } from "@/components/home/home-sticky-search";
import { PatronMembersLedgerDrawerRoot } from "@/components/home/patron-members-ledger-drawer";
import { PatronWatchLedgerDrawerRoot } from "@/components/home/patron-watch-ledger-drawer";
import { CreateListDrawerRoot } from "@/components/list/create-list-drawer";
import { QuickLogRoot } from "@/components/log/quick-log-sheet";
import { PersonFilmographyDrawerRoot } from "@/components/movie/person-filmography-drawer";
import { ReviewComposerRoot } from "@/components/review/review-composer";
import { ReviewDetailRoot } from "@/components/review/review-detail-sheet";
import { RoleChangeDialogRoot } from "@/components/staff/role-change-dialog-root";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";

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
export type AppShellUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
	avatarIsAnimated?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
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
	user,
	children,
}: {
	user: AppShellUser;
	children: ReactNode;
}) {
	return (
		<div className="relative flex min-h-svh flex-col bg-background">
			<SoftwareGpuDocumentProbe />
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
			<CatalogSearchDialogRoot viewer={{ id: user.id, handle: user.handle }} />
			<GoToDialogRoot />
			<QuickLogRoot />
			<ReviewComposerRoot />
			<ReviewDetailRoot />
			<PersonFilmographyDrawerRoot />
			<CreateListDrawerRoot />
			<PatronWatchLedgerDrawerRoot />
			<PatronMembersLedgerDrawerRoot />
			<WhatsNewDialogRoot userId={user.id} />
			<RoleChangeDialogRoot />
			<MobileTabBar
				user={{
					id: user.id,
					name: user.name,
					image: user.image,
					handle: user.handle,
					email: user.email,
					isPro: user.isPro,
					avatarIsAnimated: user.avatarIsAnimated,
					diaryMetalTier: user.diaryMetalTier ?? null,
				}}
			/>
		</div>
	);
}
