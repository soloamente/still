import { db, personFavorite } from "@still/db";
import { and, count, desc, eq, lt } from "drizzle-orm";

export type PersonFavoriteListRow = {
	tmdbPersonId: number;
	name: string;
	profileUrl: string | null;
	knownForDepartment: string | null;
	alertsEnabled: boolean;
	createdAt: Date;
};

/** Public profile Favorites count — include 0 for owner parity. */
export async function countPersonFavoritesForUser(
	userId: string,
): Promise<number> {
	const [row] = await db
		.select({ c: count() })
		.from(personFavorite)
		.where(eq(personFavorite.userId, userId));
	return Number(row?.c ?? 0);
}

const DEFAULT_PERSON_FAVORITES_PAGE = 24;

/**
 * Newest-first Favorites for the profile drawer.
 * Cursor is ISO `createdAt` of the last row (exclusive).
 */
export async function listPersonFavoritesForUser(args: {
	userId: string;
	limit?: number;
	/** ISO timestamp — load rows older than this createdAt. */
	before?: string | null;
}): Promise<{ items: PersonFavoriteListRow[]; nextBefore: string | null }> {
	const limit = Math.min(
		48,
		Math.max(1, Math.floor(args.limit ?? DEFAULT_PERSON_FAVORITES_PAGE)),
	);
	const beforeIso = args.before?.trim() || null;
	const beforeDate =
		beforeIso && !Number.isNaN(Date.parse(beforeIso))
			? new Date(beforeIso)
			: null;

	const rows = await db
		.select({
			tmdbPersonId: personFavorite.tmdbPersonId,
			name: personFavorite.name,
			profileUrl: personFavorite.profileUrl,
			knownForDepartment: personFavorite.knownForDepartment,
			alertsEnabled: personFavorite.alertsEnabled,
			createdAt: personFavorite.createdAt,
		})
		.from(personFavorite)
		.where(
			and(
				eq(personFavorite.userId, args.userId),
				beforeDate ? lt(personFavorite.createdAt, beforeDate) : undefined,
			),
		)
		.orderBy(desc(personFavorite.createdAt), desc(personFavorite.tmdbPersonId))
		.limit(limit + 1);

	const page = rows.slice(0, limit);
	const hasMore = rows.length > limit;
	const last = page[page.length - 1];
	return {
		items: page,
		nextBefore:
			hasMore && last?.createdAt ? last.createdAt.toISOString() : null,
	};
}
