"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
	buildProfileLobbyHref,
	type ProfileLedgerTabId,
	parseProfileLobbyOrder,
	parseProfileLobbyVenue,
} from "@/lib/profile-lobby-order";

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

function profileTabHref(
	handle: string,
	tab: ProfileTabId,
	orderRaw: string | null,
	venueRaw: string | null,
): string {
	const order = parseProfileLobbyOrder(orderRaw);
	const venue = parseProfileLobbyVenue(venueRaw);
	if (tab === "favorites") {
		return buildProfileLobbyHref({
			handle,
			tab: "movies",
			order,
			venue,
			favoritesOnly: true,
		});
	}
	if (tab === "movies" || tab === "tv") {
		return buildProfileLobbyHref({
			handle,
			tab,
			order,
			venue,
			favoritesOnly: false,
		});
	}
	return `/profile/${encodeURIComponent(handle)}?tab=${tab}`;
}

/**
 * Profile chips — ledger group (Movies / TV), divider, then community group (Lists, …).
 * Matches `HomeCatalogSortChips` pill styling.
 */
export function ProfileTabToolbar({
	handle,
	activeTab,
	socialTabs,
}: {
	handle: string;
	activeTab: ProfileTabId;
	/** Lists (+ favorites / reviews when the patron has them). */
	socialTabs: readonly ProfileSocialTabId[];
}) {
	const searchParams = useSearchParams();
	const orderRaw = searchParams.get("order");
	const venueRaw = searchParams.get("venue");
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipLink = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			"px-3 py-2 sm:px-3.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const ledgerTabs: ProfileLedgerTabId[] = ["movies", "tv"];

	function Chip({ tab }: { tab: ProfileTabId }) {
		const active = tab === activeTab;
		return (
			<Link
				href={profileTabHref(handle, tab, orderRaw, venueRaw)}
				scroll={false}
				aria-current={active ? "page" : undefined}
				className={chipLink(active)}
			>
				{active ? (
					<motion.span
						layoutId="profile-catalog-tab-pill"
						className="absolute inset-0 z-0 rounded-full bg-card"
						transition={pillTransition}
					/>
				) : null}
				<span className="relative z-10 whitespace-nowrap">
					{TAB_LABEL[tab]}
				</span>
			</Link>
		);
	}

	return (
		<nav
			className="flex min-w-0 max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
			role="toolbar"
			aria-label="Profile sections"
		>
			{ledgerTabs.map((tab) => (
				<Chip key={tab} tab={tab} />
			))}
			{socialTabs.length > 0 ? (
				<>
					<div
						aria-hidden
						className="mx-0.5 h-6 w-px shrink-0 self-center rounded-full bg-border/70"
					/>
					{socialTabs.map((tab) => (
						<Chip key={tab} tab={tab} />
					))}
				</>
			) : null}
		</nav>
	);
}
