import { db, reaction, review } from "@still/db";
import { and, eq, inArray, sql } from "drizzle-orm";

type ReviewReactionKind = "like" | "dislike";

/** Drop one viewer reaction on a review and decrement its denormalized counter. */
export async function removeViewerReviewReaction(
	userId: string,
	reviewId: string,
	kind: ReviewReactionKind,
): Promise<boolean> {
	const [existing] = await db
		.select()
		.from(reaction)
		.where(
			and(
				eq(reaction.userId, userId),
				eq(reaction.parentType, "review"),
				eq(reaction.parentId, reviewId),
				eq(reaction.kind, kind),
			),
		)
		.limit(1);
	if (!existing) return false;

	await db
		.delete(reaction)
		.where(
			and(
				eq(reaction.userId, userId),
				eq(reaction.parentType, "review"),
				eq(reaction.parentId, reviewId),
				eq(reaction.kind, kind),
			),
		);

	if (kind === "like") {
		await db
			.update(review)
			.set({ likesCount: sql`greatest(${review.likesCount} - 1, 0)` })
			.where(eq(review.id, reviewId));
	} else {
		await db
			.update(review)
			.set({ dislikesCount: sql`greatest(${review.dislikesCount} - 1, 0)` })
			.where(eq(review.id, reviewId));
	}

	return true;
}

/** Viewer like/dislike flags + public counters for a review. */
export async function readReviewReactionSnapshot(
	reviewId: string,
	viewerId: string | null,
) {
	const [counts] = await db
		.select({
			likesCount: review.likesCount,
			dislikesCount: review.dislikesCount,
		})
		.from(review)
		.where(eq(review.id, reviewId))
		.limit(1);

	let liked = false;
	let disliked = false;
	if (viewerId) {
		const rows = await db
			.select({ kind: reaction.kind })
			.from(reaction)
			.where(
				and(
					eq(reaction.userId, viewerId),
					eq(reaction.parentType, "review"),
					eq(reaction.parentId, reviewId),
					inArray(reaction.kind, ["like", "dislike"]),
				),
			);
		for (const row of rows) {
			if (row.kind === "like") liked = true;
			if (row.kind === "dislike") disliked = true;
		}
	}

	return {
		liked,
		disliked,
		likesCount: counts?.likesCount ?? 0,
		dislikesCount: counts?.dislikesCount ?? 0,
	};
}
