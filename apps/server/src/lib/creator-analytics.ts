import { db, list } from "@still/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
	buildCuratorHeadline,
	type CuratorContributionStats,
	fetchCuratorStatsForUser,
	qualifiesAsCurator,
} from "./creator-recognition";
import { LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS } from "./list-quality";

export interface CreatorListHighlight {
	id: string;
	title: string;
	likesCount: number;
	updatedAt: string;
	hasDescription: boolean;
}

export interface CreatorAnalyticsPayload {
	headline: string;
	stats: CuratorContributionStats;
	topLists: CreatorListHighlight[];
}

const listDescribedSql = sql`length(trim(coalesce(${list.description}, ''))) >= ${LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS}`;

/**
 * Owner-only curator dashboard — lists + review reach from existing tables (SN.13).
 */
export async function fetchCreatorAnalyticsForUser(
	userId: string,
): Promise<CreatorAnalyticsPayload | null> {
	const stats = await fetchCuratorStatsForUser(userId);
	if (!qualifiesAsCurator(stats)) return null;

	const topRows = await db
		.select({
			id: list.id,
			title: list.title,
			likesCount: list.likesCount,
			updatedAt: list.updatedAt,
			hasDescription: sql<boolean>`${listDescribedSql}`,
		})
		.from(list)
		.where(
			and(
				eq(list.userId, userId),
				eq(list.isPublic, true),
				isNull(list.removedAt),
			),
		)
		.orderBy(desc(list.likesCount), desc(list.updatedAt))
		.limit(5);

	const topLists: CreatorListHighlight[] = topRows.map((row) => ({
		id: row.id,
		title: row.title,
		likesCount: Number(row.likesCount ?? 0),
		updatedAt:
			row.updatedAt instanceof Date
				? row.updatedAt.toISOString()
				: String(row.updatedAt),
		hasDescription: Boolean(row.hasDescription),
	}));

	return {
		headline: buildCuratorHeadline(stats),
		stats,
		topLists,
	};
}
