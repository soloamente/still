/** Whether spoiler-tagged review copy should stay masked for this viewer. */
export function shouldMaskReviewSpoilers({
	containsSpoilers,
	hasWatchedMovie,
	isOwnReview = false,
	revealed = false,
}: {
	containsSpoilers: boolean;
	hasWatchedMovie: boolean;
	isOwnReview?: boolean;
	revealed?: boolean;
}): boolean {
	return containsSpoilers && !hasWatchedMovie && !isOwnReview && !revealed;
}

export const REVIEW_SPOILER_REVEAL_CTA =
	"This review contains spoilers — click to reveal";
