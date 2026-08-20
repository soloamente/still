"use client";

import { cn } from "@still/ui/lib/utils";
import { useRef } from "react";

import { useProfileLobbyParams } from "@/components/profile/profile-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
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

function tabLabel(tab: ProfileTabId) {
	return (
		<span className="whitespace-nowrap">
			<span className="sm:hidden">
				{TAB_LABEL_MOBILE[tab] ?? TAB_LABEL[tab]}
			</span>
			<span className="hidden sm:inline">{TAB_LABEL[tab]}</span>
		</span>
	);
}

/**
 * Profile chips — ledger group (Movies / TV), divider, then community group (Lists, …).
 * Liquid-gooey Move pill (home / diary parity).
 */
export function ProfileTabToolbar({
	socialTabs,
}: {
	/** Lists (+ favorites / reviews when the patron has them). */
	socialTabs: readonly ProfileSocialTabId[];
}) {
	const { toolbarActiveTab, selectTab } = useProfileLobbyParams();

	const ledgerTabs: ProfileLedgerTabId[] = ["movies", "tv"];
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollContentKey = [...ledgerTabs, ...socialTabs].join(",");
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		true,
		scrollContentKey,
	);

	const options = [
		...ledgerTabs.map((tab) => ({
			id: tab as ProfileTabId,
			label: tabLabel(tab),
		})),
		...socialTabs.map((tab, index) => ({
			id: tab as ProfileTabId,
			label: tabLabel(tab),
			separatorBefore: index === 0,
		})),
	];

	return (
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
				<SegmentedPillToolbar
					layoutId="profile-catalog-tab-pill"
					aria-label="Profile sections"
					value={toolbarActiveTab}
					onChange={selectTab}
					options={options}
					compact
					optionClassName="px-2.5 py-2 sm:px-3.5 shrink-0"
					className="w-fit max-w-none shrink-0 flex-nowrap"
				/>
			</div>
		</div>
	);
}
