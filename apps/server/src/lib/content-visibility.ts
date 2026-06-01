import type { ContentVisibility } from "@still/db";
import { db, follow } from "@still/db";
import { and, eq, exists, or, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { t } from "elysia";

/** Typebox literal for request bodies that accept a visibility. */
export const visibilitySchema = t.Union([
	t.Literal("public"),
	t.Literal("followers"),
	t.Literal("friends"),
	t.Literal("private"),
]);

/**
 * Pure visibility check for a single fetched row. Caller resolves the two
 * follow booleans (or uses the SQL fragment below for list queries).
 */
export function canViewContent(args: {
	viewerId: string | null;
	authorId: string;
	visibility: ContentVisibility;
	viewerFollowsAuthor: boolean;
	viewerIsMutual: boolean;
}): boolean {
	const { viewerId, authorId, visibility } = args;
	if (viewerId && viewerId === authorId) return true;
	switch (visibility) {
		case "public":
			return true;
		case "followers":
			return args.viewerFollowsAuthor;
		case "friends":
			return args.viewerIsMutual;
		case "private":
			return false;
	}
}

/**
 * Drizzle WHERE fragment keeping only rows the viewer may see. Pass the
 * author-id and visibility columns of the table being filtered. A `null`
 * viewerId means anonymous (public only). Reuse everywhere attributed
 * review/log rows are read so the rule never drifts.
 */
export function contentVisibilityWhere(
	viewerId: string | null,
	authorCol: PgColumn,
	visibilityCol: PgColumn,
): SQL {
	const conditions: SQL[] = [eq(visibilityCol, "public")];
	if (viewerId) {
		conditions.push(eq(authorCol, viewerId));
		conditions.push(
			and(
				eq(visibilityCol, "followers"),
				exists(
					db
						.select({ one: sql`1` })
						.from(follow)
						.where(
							and(
								eq(follow.followerId, viewerId),
								eq(follow.followingId, authorCol),
							),
						),
				),
			) as SQL,
		);
		conditions.push(
			and(
				eq(visibilityCol, "friends"),
				exists(
					db
						.select({ one: sql`1` })
						.from(follow)
						.where(
							and(
								eq(follow.followerId, viewerId),
								eq(follow.followingId, authorCol),
								eq(follow.isMutual, true),
							),
						),
				),
			) as SQL,
		);
	}
	return or(...conditions) as SQL;
}

/** Resolve the two follow booleans for a single (viewer, author) pair. */
export async function resolveViewerFollow(
	viewerId: string | null,
	authorId: string,
): Promise<{ viewerFollowsAuthor: boolean; viewerIsMutual: boolean }> {
	if (!viewerId || viewerId === authorId) {
		return { viewerFollowsAuthor: false, viewerIsMutual: false };
	}
	const [row] = await db
		.select({ isMutual: follow.isMutual })
		.from(follow)
		.where(
			and(eq(follow.followerId, viewerId), eq(follow.followingId, authorId)),
		)
		.limit(1);
	return {
		viewerFollowsAuthor: Boolean(row),
		viewerIsMutual: Boolean(row?.isMutual),
	};
}
