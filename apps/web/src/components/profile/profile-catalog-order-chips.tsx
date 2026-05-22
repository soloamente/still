"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type { ProfileLedgerTabId } from "@/lib/profile-lobby-order";
import {
	buildProfileLobbyHref,
	type ProfileLobbyOrder,
	parseProfileLobbyFavorites,
	parseProfileLobbyOrder,
	parseProfileLobbyVenue,
} from "@/lib/profile-lobby-order";

const CHIPS: readonly {
	id: ProfileLobbyOrder;
	label: string;
	title: string;
	ariaLabel: string;
}[] = [
	{
		id: "latest_seen",
		label: "Latest seen",
		title: "Newest screenings first — when they watched each title",
		ariaLabel: "Latest seen — order by most recent watch date",
	},
	{
		id: "earliest_seen",
		label: "Earliest seen",
		title: "Oldest screenings first — chronological from their first log",
		ariaLabel: "Earliest seen — order by oldest watch date first",
	},
	{
		id: "title_az",
		label: "By title",
		title:
			"Alphabetical by title (A–Z), then newest watch within the same title",
		ariaLabel: "By title — alphabetical order",
	},
] as const;

/**
 * Left chip rail on profile Movies / TV — same order model as `/diary`.
 */
export function ProfileCatalogOrderChips({
	handle,
	ledgerTab,
}: {
	handle: string;
	ledgerTab: ProfileLedgerTabId;
}) {
	const searchParams = useSearchParams();
	const order = parseProfileLobbyOrder(searchParams.get("order"));
	const venue = parseProfileLobbyVenue(searchParams.get("venue"));
	const favoritesOnly = parseProfileLobbyFavorites(
		searchParams.get("favorites"),
	);
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
			"relative inline-flex min-h-10 items-center justify-center rounded-full px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none sm:px-3.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const sortToolbarDescId = "profile-catalog-order-desc";

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				Choose how this patron&apos;s logged titles are ordered — by watch date
				or alphabetically.
			</p>
			<div
				className="flex max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
				role="toolbar"
				aria-label="Profile catalogue order"
				aria-describedby={sortToolbarDescId}
			>
				{CHIPS.map(({ id, label, title, ariaLabel }) => (
					<Link
						key={id}
						href={buildProfileLobbyHref({
							handle,
							tab: ledgerTab,
							order: id,
							venue,
							favoritesOnly,
						})}
						scroll={false}
						aria-current={order === id ? "page" : undefined}
						className={chipLink(order === id)}
						title={title}
						aria-label={ariaLabel}
					>
						{order === id ? (
							<motion.span
								layoutId="profile-catalog-order-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</Link>
				))}
			</div>
		</div>
	);
}
