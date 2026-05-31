/** Inbox deep link: movie detail with review reader sheet (`?review=`). */
export function movieReviewNotificationHref(
	movieId: number,
	reviewId: string,
): string {
	return `/movies/${movieId}?review=${encodeURIComponent(reviewId)}`;
}
