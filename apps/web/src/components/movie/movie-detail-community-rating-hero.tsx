"use client";

import IconPatronScoreLeafLeft from "@still/ui/icons/patron-score-leaf-left";
import IconPatronScoreLeafRight from "@still/ui/icons/patron-score-leaf-right";
import { cn } from "@still/ui/lib/utils";

import { StillAnimateRatingNumber } from "@/components/ui/still-animate-rating-number";
import { APP_COMMUNITY_AVERAGE_LABEL } from "@/lib/app-brand";
import { formatLogRatingDisplay, logRatingToDisplay } from "@/lib/log-rating";

/** Tier headline above the score — supporting line is only the ratings count. */
function patronScoreTitle(average: number, ratingsCount: number): string {
	if (ratingsCount >= 8 && average >= 8.5) return "Patron favorite";
	if (ratingsCount >= 3 && average >= 7.5) return "Well rated";
	return APP_COMMUNITY_AVERAGE_LABEL;
}

function formatPatronRatingsCountLine(count: number): string {
	return `${count} public ${count === 1 ? "rating" : "ratings"}`;
}

/**
 * Patron community score — `compact` under hero synopsis; `featured` for large standalone blocks.
 */
export function MovieDetailCommunityRatingHero({
	communityAverage,
	communityRatingsCount,
	variant = "featured",
	className,
}: {
	communityAverage: number | null;
	communityRatingsCount: number;
	variant?: "featured" | "compact";
	className?: string;
}) {
	const hasAverage =
		communityAverage != null &&
		communityRatingsCount > 0 &&
		Number.isFinite(communityAverage);

	const displayAverage =
		communityAverage != null ? logRatingToDisplay(communityAverage) : null;

	const title =
		hasAverage && displayAverage != null
			? patronScoreTitle(displayAverage, communityRatingsCount)
			: "No patron score yet";
	const emptyDescription = "Log this title with a score.";
	const isCompact = variant === "compact";

	if (isCompact && !hasAverage) return null;

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
			<div
				className={cn(
					"flex items-center justify-center",
					isCompact ? "gap-2 sm:gap-2.5" : "gap-2 sm:gap-4",
				)}
			>
				<IconPatronScoreLeafLeft
					className={cn(leafClass, !hasAverage && "opacity-40")}
				/>
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
				) : (
					<div
						className={cn(
							"font-sans font-semibold text-muted-foreground/80 tabular-nums tracking-tight",
							isCompact ? "text-xl sm:text-2xl" : "text-4xl sm:text-5xl",
						)}
						aria-hidden
					>
						—
					</div>
				)}
				<IconPatronScoreLeafRight
					className={cn(leafClass, !hasAverage && "opacity-40")}
				/>
			</div>

			{isCompact ? (
				<p className="text-balance font-sans text-muted-foreground text-sm tabular-nums">
					{formatPatronRatingsCountLine(communityRatingsCount)}
				</p>
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
				</>
			)}
		</section>
	);
}
