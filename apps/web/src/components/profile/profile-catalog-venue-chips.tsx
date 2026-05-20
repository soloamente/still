"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type { ProfileLedgerTabId } from "@/lib/profile-lobby-order";
import {
	buildProfileLobbyHref,
	parseProfileLobbyOrder,
	parseProfileLobbyVenue,
} from "@/lib/profile-lobby-order";

/**
 * Watch-venue rail on profile Movies / TV — **In cinemas** vs **At home** (diary parity).
 */
export function ProfileCatalogVenueChips({
	handle,
	ledgerTab,
}: {
	handle: string;
	ledgerTab: ProfileLedgerTabId;
}) {
	const searchParams = useSearchParams();
	const order = parseProfileLobbyOrder(searchParams.get("order"));
	const venue = parseProfileLobbyVenue(searchParams.get("venue"));
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
			"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const toolbarDescId = "profile-catalog-venue-desc";
	const theatersActive = venue === "theaters";
	const streamingActive = venue === "streaming";

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={toolbarDescId} className="sr-only">
				Filter this patron&apos;s logged titles by whether they watched in
				cinemas or at home.
			</p>
			<div
				className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
				role="toolbar"
				aria-label="Watch venue"
				aria-describedby={toolbarDescId}
			>
				<Link
					href={buildProfileLobbyHref({
						handle,
						tab: ledgerTab,
						order,
						venue: "theaters",
					})}
					scroll={false}
					aria-current={theatersActive ? "page" : undefined}
					className={chipLink(theatersActive)}
					title="Screenings logged as watched in cinemas"
					aria-label="In cinemas — theatrical watch logs"
				>
					{theatersActive ? (
						<motion.span
							layoutId="profile-catalog-venue-pill"
							className="absolute inset-0 z-0 rounded-full bg-card"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">In cinemas</span>
				</Link>
				<Link
					href={buildProfileLobbyHref({
						handle,
						tab: ledgerTab,
						order,
						venue: "streaming",
					})}
					scroll={false}
					aria-current={streamingActive ? "page" : undefined}
					className={chipLink(streamingActive)}
					title="Screenings logged as watched at home"
					aria-label="At home — streaming or home watch logs"
				>
					{streamingActive ? (
						<motion.span
							layoutId="profile-catalog-venue-pill"
							className="absolute inset-0 z-0 rounded-full bg-card"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">At home</span>
				</Link>
			</div>
		</div>
	);
}
