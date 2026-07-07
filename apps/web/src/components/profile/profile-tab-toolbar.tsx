"use client";

import { cn } from "@still/ui/lib/utils";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { useProfileLobbyParams } from "@/components/profile/profile-lobby-params-context";
import {
	HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
	HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import type { ProfileLedgerTabId } from "@/lib/profile-lobby-order";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

export type { ProfileLedgerTabId } from "@/lib/profile-lobby-order";

/** Community rails after the ledger separator. */
export type ProfileSocialTabId = "favorites" | "reviews" | "lists";

export type ProfileTabId = ProfileLedgerTabId | ProfileSocialTabId;

const TAB_LABEL: Record<ProfileTabId, string> = {
	movies: "Movies",
	tv: "TV Shows",
	favorites: "Favorites",
	reviews: "Reviews",
	lists: "Lists",
};

/** Shorter mobile copy so the ledger + social chips stay on one pill row. */
const TAB_LABEL_MOBILE: Partial<Record<ProfileTabId, string>> = {
	tv: "TV",
};

const PROFILE_TAB_PILL_LAYOUT_ID = "profile-catalog-tab-pill";

/** Stable chip — must live at module scope so RSC refreshes do not remount chips and replay the layout pill. */
function ProfileTabChip({
	tab,
	active,
	pillTransition,
	onSelect,
}: {
	tab: ProfileTabId;
	active: boolean;
	pillTransition:
		| { duration: number }
		| {
				type: "tween";
				duration: number;
				ease: readonly [number, number, number, number];
		  };
	onSelect: (tab: ProfileTabId) => void;
}) {
	return (
		<button
			type="button"
			aria-current={active ? "page" : undefined}
			className={cn(
				"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
				"px-2.5 py-2 sm:px-3.5",
				active
					? "text-foreground"
					: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
			)}
			onClick={() => onSelect(tab)}
		>
			{active ? (
				<motion.span
					layoutId={PROFILE_TAB_PILL_LAYOUT_ID}
					className="absolute inset-0 z-0 rounded-full bg-card"
					transition={pillTransition}
				/>
			) : null}
			<span className="relative z-10 whitespace-nowrap">
				<span className="sm:hidden">
					{TAB_LABEL_MOBILE[tab] ?? TAB_LABEL[tab]}
				</span>
				<span className="hidden sm:inline">{TAB_LABEL[tab]}</span>
			</span>
		</button>
	);
}

/**
 * Profile chips — ledger group (Movies / TV), divider, then community group (Lists, …).
 * Matches `HomeCatalogSortChips` pill styling.
 */
export function ProfileTabToolbar({
	socialTabs,
}: {
	/** Lists (+ favorites / reviews when the patron has them). */
	socialTabs: readonly ProfileSocialTabId[];
}) {
	const { toolbarActiveTab, selectTab } = useProfileLobbyParams();
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const ledgerTabs: ProfileLedgerTabId[] = ["movies", "tv"];
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollContentKey = [...ledgerTabs, ...socialTabs].join(",");
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		true,
		scrollContentKey,
	);

	return (
		<LayoutGroup id="profile-catalog-tab-pill-group">
			<div className="relative min-w-0 max-w-full overflow-hidden sm:overflow-visible">
				<div
					aria-hidden
					className={cn(
						HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
						"transition-opacity duration-200 motion-reduce:transition-none sm:hidden",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
						"transition-opacity duration-200 motion-reduce:transition-none sm:hidden",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					ref={scrollRef}
					className={cn(
						HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
						"justify-center gap-0 pb-0 sm:overflow-visible",
					)}
					data-lenis-prevent-wheel
				>
					<nav
						className="flex w-fit max-w-none shrink-0 flex-nowrap gap-1 rounded-full bg-background p-1"
						role="toolbar"
						aria-label="Profile sections"
					>
						{ledgerTabs.map((tab) => (
							<ProfileTabChip
								key={tab}
								tab={tab}
								active={tab === toolbarActiveTab}
								pillTransition={pillTransition}
								onSelect={selectTab}
							/>
						))}
						{socialTabs.length > 0 ? (
							<>
								<div
									aria-hidden
									className="mx-0.5 h-6 w-px shrink-0 self-center rounded-full bg-border/70"
								/>
								{socialTabs.map((tab) => (
									<ProfileTabChip
										key={tab}
										tab={tab}
										active={tab === toolbarActiveTab}
										pillTransition={pillTransition}
										onSelect={selectTab}
									/>
								))}
							</>
						) : null}
					</nav>
				</div>
			</div>
		</LayoutGroup>
	);
}
