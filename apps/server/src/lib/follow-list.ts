import { db, follow } from "@still/db";
import { and, eq, inArray } from "drizzle-orm";

/** Who the signed-in viewer follows among a page of profile list user ids. */
export async function fetchViewerFollowingIds(
	viewerId: string,
	userIds: string[],
): Promise<Set<string>> {
	const unique = [...new Set(userIds.filter(Boolean))];
	if (unique.length === 0) return new Set();

	const links = await db
		.select({ followingId: follow.followingId })
		.from(follow)
		.where(
			and(eq(follow.followerId, viewerId), inArray(follow.followingId, unique)),
		);

	return new Set(links.map((row) => row.followingId));
}

/**
 * Annotates follower/following rows with whether the viewer already follows
 * each listed user, given the set of ids the viewer follows. Pure so the
 * drawer's per-row button state is unit-testable without a DB.
 */
export function annotateViewerFollows<T extends { userId: string }>(
	rows: T[],
	followingIds: Set<string>,
): (T & { viewerFollows: boolean })[] {
	return rows.map((row) => ({
		...row,
		viewerFollows: followingIds.has(row.userId),
	}));
}
