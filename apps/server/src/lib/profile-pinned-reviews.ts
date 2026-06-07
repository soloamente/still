import { db, movie, review } from "@still/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

/** Patron-chosen signature reviews on profile hero (ST.3). */
export const MAX_PINNED_REVIEWS = 3;

export type PinnedReviewRow = {
	review: typeof review.$inferSelect;
	movie: typeof movie.$inferSelect | null;
};

/** Normalize + dedupe incoming pin ids while preserving order. */
export function normalizePinnedReviewIds(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const entry of raw) {
		if (typeof entry !== "string") continue;
		const id = entry.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
		if (ids.length >= MAX_PINNED_REVIEWS) break;
	}
	return ids;
}

/**
 * Validate pins belong to the patron and are public.
 * Returns ordered ids on success.
 */
export async function validatePinnedReviewIdsForUser(
	userId: string,
	rawIds: unknown,
): Promise<
	{ ok: true; reviewIds: string[] } | { ok: false; status: 400; error: string }
> {
	const reviewIds = normalizePinnedReviewIds(rawIds);
	if (reviewIds.length === 0) return { ok: true, reviewIds: [] };

	const rows = await db
		.select({ id: review.id })
		.from(review)
		.where(
			and(
				eq(review.userId, userId),
				eq(review.visibility, "public"),
				isNull(review.removedAt),
				inArray(review.id, reviewIds),
			),
		);

	if (rows.length !== reviewIds.length) {
		return {
			ok: false,
			status: 400,
			error: "Pins must be your own public reviews",
		};
	}

	return { ok: true, reviewIds };
}

/** Hydrate pinned reviews in patron-defined order; drops stale or private rows. */
export async function hydratePinnedReviews(
	userId: string,
	rawIds: unknown,
): Promise<PinnedReviewRow[]> {
	const reviewIds = normalizePinnedReviewIds(rawIds);
	if (reviewIds.length === 0) return [];

	const rows = await db
		.select({ review, movie })
		.from(review)
		.leftJoin(movie, eq(review.movieId, movie.tmdbId))
		.where(
			and(
				eq(review.userId, userId),
				eq(review.visibility, "public"),
				isNull(review.removedAt),
				inArray(review.id, reviewIds),
			),
		);

	const byId = new Map(rows.map((row) => [row.review.id, row]));
	return reviewIds
		.map((id) => byId.get(id))
		.filter((row): row is PinnedReviewRow => row != null);
}

/** Drop a deleted review id from the patron's pinned list. */
export function removePinnedReviewId(
	rawIds: unknown,
	reviewId: string,
): string[] {
	return normalizePinnedReviewIds(rawIds).filter((id) => id !== reviewId);
}
