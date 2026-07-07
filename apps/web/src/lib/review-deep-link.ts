/** Query param on movie detail — opens the review reader sheet (`ReviewDetailRoot`). */
export const MOVIE_REVIEW_SEARCH_PARAM = "review" as const;

/** Optional anchor on movie detail — scrolls the review reader to a comment row. */
export const MOVIE_REVIEW_COMMENT_SEARCH_PARAM = "comment" as const;

export function buildMovieReviewHref(
	movieId: number,
	reviewId: string,
	commentId?: string,
): string {
	const base = `/movies/${movieId}?${MOVIE_REVIEW_SEARCH_PARAM}=${encodeURIComponent(reviewId)}`;
	if (!commentId?.trim()) return base;
	return `${base}&${MOVIE_REVIEW_COMMENT_SEARCH_PARAM}=${encodeURIComponent(commentId.trim())}`;
}

/** Legacy `/reviews/:id` paths from older notification rows. */
export function parseLegacyReviewPagePath(
	href: string,
): { reviewId: string } | null {
	const match = /^\/reviews\/([^/?#]+)/.exec(href);
	if (!match?.[1]) return null;
	return { reviewId: decodeURIComponent(match[1]) };
}
