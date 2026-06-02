"use client";

import IconPatronScoreLeafLeft from "@still/ui/icons/patron-score-leaf-left";
import IconPatronScoreLeafRight from "@still/ui/icons/patron-score-leaf-right";
import { cn } from "@still/ui/lib/utils";

import { StillAnimateRatingNumber } from "@/components/ui/still-animate-rating-number";
import { APP_COMMUNITY_AVERAGE_LABEL, APP_NAME } from "@/lib/app-brand";
import { formatLogRatingDisplay, logRatingToDisplay } from "@/lib/log-rating";

/** Headline + supporting copy for the patron-score hero (Airbnb “guest favorite” pattern). */
function patronScoreHeadline(
	average: number,
	reviewCount: number,
): { title: string; description: string } {
	if (reviewCount >= 8 && average >= 8.5) {
		return {
			title: "Patron favorite",
			description: `One of the most loved titles on ${APP_NAME} based on member ratings, published reviews, and list presence.`,
		};
	}
	if (reviewCount >= 3 && average >= 7.5) {
		return {
			title: `Well rated on ${APP_NAME}`,
			description:
				"Members consistently score this title highly in published reviews and diary ratings.",
		};
	}
	return {
		title: APP_COMMUNITY_AVERAGE_LABEL,
		description: `Community score from published member reviews on ${APP_NAME}’s 0–10 patron scale.`,
	};
}

/**
 * Centered patron-score block for film detail — large tabular score flanked by laurels,
 * bold headline, and balanced supporting copy (Mobbin / Airbnb guest-favorite pattern).
 */
export function MovieDetailCommunityRatingHero({
	communityAverage,
	communityReviewsCount,
	className,
}: {
	communityAverage: number | null;
	communityReviewsCount: number;
	className?: string;
}) {
	const hasAverage =
		communityAverage != null &&
		communityReviewsCount > 0 &&
		Number.isFinite(communityAverage);

	const displayAverage =
		communityAverage != null ? logRatingToDisplay(communityAverage) : null;

	const { title, description } =
		hasAverage && displayAverage != null
			? patronScoreHeadline(displayAverage, communityReviewsCount)
			: {
					title: "No patron score yet",
					description: `Publish a review with a rating to seed the ${APP_COMMUNITY_AVERAGE_LABEL} for this title.`,
				};

	return (
		<section
			className={cn(
				"mx-auto flex w-full max-w-md flex-col items-center px-4 py-10 text-center sm:max-w-lg sm:py-12",
				className,
			)}
			aria-label={`${APP_NAME} community rating`}
		>
			{/* Score row — laurels frame the primary metric like Airbnb guest-favorite. */}
			<div className="flex items-center justify-center gap-2 sm:gap-4">
				<IconPatronScoreLeafLeft
					className={cn(
						"h-20 w-auto shrink-0 text-foreground/55 sm:h-24",
						!hasAverage && "opacity-40",
					)}
				/>
				{hasAverage && displayAverage != null ? (
					<div className="font-sans font-semibold text-5xl text-foreground tabular-nums tracking-tight sm:text-6xl">
						<span className="sr-only">
							{APP_COMMUNITY_AVERAGE_LABEL}{" "}
							{formatLogRatingDisplay(displayAverage)} out of 10
						</span>
						<StillAnimateRatingNumber
							value={displayAverage}
							className="text-5xl sm:text-6xl"
						/>
					</div>
				) : (
					<div
						className="font-sans font-semibold text-4xl text-muted-foreground/80 tabular-nums tracking-tight sm:text-5xl"
						aria-hidden
					>
						—
					</div>
				)}
				<IconPatronScoreLeafRight
					className={cn(
						"h-20 w-auto shrink-0 text-foreground/55 sm:h-24",
						!hasAverage && "opacity-40",
					)}
				/>
			</div>

			<h3 className="mt-5 font-sans font-semibold text-foreground text-lg tracking-tight sm:text-xl">
				{title}
			</h3>

			<p className="mt-2 max-w-md text-balance font-sans text-muted-foreground text-sm leading-relaxed sm:text-[15px]">
				{hasAverage ? (
					<>
						{description}{" "}
						<span className="text-foreground/80 tabular-nums">
							{communityReviewsCount}{" "}
							{communityReviewsCount === 1 ? "review" : "reviews"}
						</span>
						.
					</>
				) : (
					description
				)}
			</p>
		</section>
	);
}
