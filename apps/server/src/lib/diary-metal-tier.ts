import { db, log } from "@still/db";
import { and, inArray, isNull, sql } from "drizzle-orm";

export type DiaryMetalTier = "silver" | "gold" | "chromatic";

/** Map diary log volume to metal avatar tier — mirrors watch_100/500/1000 badges. */
export function resolveDiaryMetalTier(
	logsCount: number,
): DiaryMetalTier | null {
	if (logsCount >= 150) return "chromatic";
	if (logsCount >= 100) return "gold";
	if (logsCount >= 50) return "silver";
	return null;
}

/** Batch diary log counts for avatar tier hydration — one query per page. */
export async function fetchDiaryLogCountsForUserIds(
	userIds: readonly string[],
): Promise<Map<string, number>> {
	const unique = [...new Set(userIds.filter(Boolean))];
	const map = new Map<string, number>();
	if (unique.length === 0) return map;

	const rows = await db
		.select({
			userId: log.userId,
			c: sql<number>`count(*)::int`,
		})
		.from(log)
		.where(and(inArray(log.userId, unique), isNull(log.removedAt)))
		.groupBy(log.userId);

	for (const row of rows) {
		map.set(row.userId, Number(row.c ?? 0));
	}
	return map;
}

export function diaryMetalTierForUserId(
	userId: string,
	counts: Map<string, number>,
): DiaryMetalTier | null {
	return resolveDiaryMetalTier(counts.get(userId) ?? 0);
}
