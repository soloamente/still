import { comment, db, reaction } from "@still/db";
import { and, eq, inArray, sql } from "drizzle-orm";

type CommentReactionKind = "like" | "dislike";

/** Drop one viewer reaction on a comment and decrement its denormalized counter. */
export async function removeViewerCommentReaction(
	userId: string,
	commentId: string,
	kind: CommentReactionKind,
): Promise<boolean> {
	const [existing] = await db
		.select()
		.from(reaction)
		.where(
			and(
				eq(reaction.userId, userId),
				eq(reaction.parentType, "comment"),
				eq(reaction.parentId, commentId),
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
				eq(reaction.parentType, "comment"),
				eq(reaction.parentId, commentId),
				eq(reaction.kind, kind),
			),
		);

	if (kind === "like") {
		await db
			.update(comment)
			.set({ likesCount: sql`greatest(${comment.likesCount} - 1, 0)` })
			.where(eq(comment.id, commentId));
	} else {
		await db
			.update(comment)
			.set({ dislikesCount: sql`greatest(${comment.dislikesCount} - 1, 0)` })
			.where(eq(comment.id, commentId));
	}

	return true;
}

/** Viewer like/dislike flags + public counters for one comment. */
export async function readCommentReactionSnapshot(
	commentId: string,
	viewerId: string | null,
) {
	const [counts] = await db
		.select({
			likesCount: comment.likesCount,
			dislikesCount: comment.dislikesCount,
		})
		.from(comment)
		.where(eq(comment.id, commentId))
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
					eq(reaction.parentType, "comment"),
					eq(reaction.parentId, commentId),
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
