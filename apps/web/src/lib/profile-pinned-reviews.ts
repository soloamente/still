/** Mirrors `apps/server/src/lib/profile-pinned-reviews.ts` for profile UI. */

export const MAX_PINNED_REVIEWS = 3;

export type SavePinnedReviewsResult =
	| { ok: true; pinnedReviewIds: string[] }
	| { ok: false; message: string };

/** Toggle one review id in the patron pin list (max 3). */
export function togglePinnedReviewId(
	current: readonly string[],
	reviewId: string,
): string[] | { error: "max" } {
	if (current.includes(reviewId)) {
		return current.filter((id) => id !== reviewId);
	}
	if (current.length >= MAX_PINNED_REVIEWS) {
		return { error: "max" };
	}
	return [...current, reviewId];
}
