"use client";

import { cn } from "@still/ui/lib/utils";

import { ProfilePinnedReviewCard } from "@/components/profile/profile-pinned-review-card";
import type { ProfileReviewRow } from "@/components/profile/profile-reviews-panel";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";

function normalizePublishedAt(value: unknown): string {
	if (typeof value === "string") return value;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	return new Date().toISOString();
}

function toPinnedReviewProps(row: ProfileReviewRow) {
	const { review, movie } = row;
	return {
		id: review.id,
		title: review.title,
		body: review.body,
		rating: review.rating,
		likesCount: review.likesCount,
		commentsCount: review.commentsCount,
		publishedAt: normalizePublishedAt(review.publishedAt),
		listing: movie
			? {
					title: movie.title,
					posterUrl: profilePosterUrlFromPath(movie.posterPath),
					href: `/movies/${movie.tmdbId}`,
					listingKind: "movie" as const,
				}
			: undefined,
	};
}

/**
 * Up to three patron-chosen reviews under the profile identity block (ST.3).
 */
export function ProfilePinnedReviewsStrip({
	rows,
	className,
}: {
	rows: ProfileReviewRow[];
	className?: string;
}) {
	if (rows.length === 0) return null;

	return (
		<section
			className={cn("mx-auto mt-5 w-full max-w-md text-left", className)}
			aria-label="Signature reviews"
		>
			<p className="mb-2 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
				Signature reviews
			</p>
			<div
				className={cn(
					"flex snap-x snap-mandatory gap-2 overflow-x-auto pb-0.5",
					"scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
				)}
			>
				{rows.map((row) => (
					<div
						key={row.review.id}
						className="w-[min(100%,18rem)] shrink-0 snap-start sm:w-72"
					>
						<ProfilePinnedReviewCard review={toPinnedReviewProps(row)} />
					</div>
				))}
			</div>
		</section>
	);
}
