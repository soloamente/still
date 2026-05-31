/** Query param on movie detail — opens the review reader sheet (`ReviewDetailRoot`). */
export const MOVIE_REVIEW_SEARCH_PARAM = "review" as const;

export function buildMovieReviewHref(
	movieId: number,
	reviewId: string,
): string {
	return `/movies/${movieId}?${MOVIE_REVIEW_SEARCH_PARAM}=${encodeURIComponent(reviewId)}`;
}

/** Legacy `/reviews/:id` paths from older notification rows. */
export function parseLegacyReviewPagePath(
	href: string,
): { reviewId: string } | null {
	const match = /^\/reviews\/([^/?#]+)/.exec(href);
	if (!match?.[1]) return null;
	return { reviewId: decodeURIComponent(match[1]) };
}
