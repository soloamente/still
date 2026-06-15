"use client";

import IconPatronScoreLeafLeft from "@still/ui/icons/patron-score-leaf-left";
import IconPatronScoreLeafRight from "@still/ui/icons/patron-score-leaf-right";
import { cn } from "@still/ui/lib/utils";

import { StillAnimateRatingNumber } from "@/components/ui/still-animate-rating-number";
import { APP_COMMUNITY_AVERAGE_LABEL } from "@/lib/app-brand";
import {
	clampLogRatingDisplay,
	formatLogRatingDisplay,
} from "@/lib/log-rating";

/** Tier headline above the score — supporting line is only the ratings count. */
function patronScoreTitle(average: number, ratingsCount: number): string {
	if (ratingsCount >= 8 && average >= 8.5) return "Patron favorite";
	if (ratingsCount >= 3 && average >= 7.5) return "Well rated";
	return APP_COMMUNITY_AVERAGE_LABEL;
}

function formatPatronRatingsCountLine(count: number): string {
	return `${count} public ${count === 1 ? "rating" : "ratings"}`;
}

/** Watches + watchlist totals — only non-null counts are included. */
function formatListingEngagementMetaLine(
	watchesCount: number | null,
	watchlistCount: number | null,
): string | null {
	const parts: string[] = [];
	if (watchesCount != null) {
		parts.push(`${watchesCount} ${watchesCount === 1 ? "watch" : "watches"}`);
	}
	if (watchlistCount != null) {
		parts.push(`${watchlistCount} on watchlists`);
	}
	return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Patron community score — `compact` under hero synopsis; `featured` for large standalone blocks.
 */
export function MovieDetailCommunityRatingHero({
	communityAverage,
	communityRatingsCount,
	communityWatchesCount = null,
	communityWatchlistCount = null,
	variant = "featured",
	className,
}: {
	communityAverage: number | null;
	communityRatingsCount: number;
	communityWatchesCount?: number | null;
	communityWatchlistCount?: number | null;
	variant?: "featured" | "compact";
	className?: string;
}) {
	const hasAverage =
		communityAverage != null &&
		communityRatingsCount > 0 &&
		Number.isFinite(communityAverage);

	/** API `community.averageRating` is already on the 0–10 display scale (not log tenths). */
	const displayAverage =
		communityAverage != null ? clampLogRatingDisplay(communityAverage) : null;

	const title =
		hasAverage && displayAverage != null
			? patronScoreTitle(displayAverage, communityRatingsCount)
			: "No patron score yet";
	const emptyDescription = "Log this title with a score.";
	const isCompact = variant === "compact";
	const engagementMeta = formatListingEngagementMetaLine(
		communityWatchesCount,
		communityWatchlistCount,
	);

	if (isCompact && !hasAverage && !engagementMeta) return null;

	const leafClass = isCompact
		? "h-10 w-auto shrink-0 text-foreground/55 sm:h-11"
		: "h-20 w-auto shrink-0 text-foreground/55 sm:h-24";

	return (
		<section
			className={cn(
				isCompact
					? "mt-4 flex w-full flex-col items-center gap-1.5 text-center"
					: "mx-auto flex w-full max-w-md flex-col items-center px-4 py-10 text-center sm:max-w-lg sm:py-12",
				className,
			)}
			aria-label="Community rating"
		>
			{/* Score row — laurels frame the primary metric like Airbnb guest-favorite. */}
			{hasAverage ? (
				<div
					className={cn(
						"flex items-center justify-center",
						isCompact ? "gap-2 sm:gap-2.5" : "gap-2 sm:gap-4",
					)}
				>
					<IconPatronScoreLeafLeft className={leafClass} />
					{hasAverage && displayAverage != null ? (
						<div
							className={cn(
								"font-sans font-semibold text-foreground tabular-nums tracking-tight",
								isCompact ? "text-xl sm:text-2xl" : "text-5xl sm:text-6xl",
							)}
						>
							<span className="sr-only">
								{APP_COMMUNITY_AVERAGE_LABEL}{" "}
								{formatLogRatingDisplay(displayAverage)} out of 10
							</span>
							{isCompact ? (
								formatLogRatingDisplay(displayAverage)
							) : (
								<StillAnimateRatingNumber
									value={displayAverage}
									className="text-5xl sm:text-6xl"
								/>
							)}
						</div>
					) : null}
					<IconPatronScoreLeafRight className={leafClass} />
				</div>
			) : null}

			{isCompact ? (
				<div className="flex flex-col items-center gap-1">
					{hasAverage ? (
						<p className="text-balance font-sans text-muted-foreground text-sm tabular-nums">
							{formatPatronRatingsCountLine(communityRatingsCount)}
						</p>
					) : null}
					{engagementMeta ? (
						<p className="text-balance font-sans text-muted-foreground text-sm tabular-nums">
							{engagementMeta}
						</p>
					) : null}
				</div>
			) : (
				<>
					<h3 className="mt-5 font-sans font-semibold text-foreground text-lg tracking-tight sm:text-xl">
						{title}
					</h3>
					<p className="mt-2 max-w-md text-balance font-sans text-muted-foreground text-sm leading-relaxed sm:text-[15px]">
						{hasAverage ? (
							<span className="text-foreground/80 tabular-nums">
								{formatPatronRatingsCountLine(communityRatingsCount)}
							</span>
						) : (
							emptyDescription
						)}
					</p>
					{engagementMeta ? (
						<p className="mt-2 max-w-md text-balance font-sans text-muted-foreground text-sm tabular-nums sm:text-[15px]">
							{engagementMeta}
						</p>
					) : null}
				</>
			)}
		</section>
	);
}
