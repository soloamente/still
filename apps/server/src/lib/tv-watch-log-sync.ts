import { db, log, tvWatch } from "@still/db";
import { and, count, eq } from "drizzle-orm";

/** Pure guard — `tv_watch` stays while any diary log exists for the show. */
export function shouldRetainTvWatchAfterDiaryLogs(
	remainingDiaryLogCount: number,
): boolean {
	return remainingDiaryLogCount > 0;
}

/**
 * Drops `tv_watch` (and cascaded episode rows) when the patron has no diary logs left
 * for that show — keeps **Continue watching** in sync after **Remove from watched**.
 */
export async function clearTvWatchIfNoDiaryLogsForShow(
	userId: string,
	tvId: number,
): Promise<boolean> {
	const [row] = await db
		.select({ n: count() })
		.from(log)
		.where(and(eq(log.userId, userId), eq(log.tvId, tvId)))
		.limit(1);

	if (shouldRetainTvWatchAfterDiaryLogs(row?.n ?? 0)) return false;

	const deleted = await db
		.delete(tvWatch)
		.where(and(eq(tvWatch.userId, userId), eq(tvWatch.tvId, tvId)))
		.returning({ id: tvWatch.id });

	return deleted.length > 0;
}
