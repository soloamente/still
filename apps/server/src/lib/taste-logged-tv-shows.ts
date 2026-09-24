import { db, log } from "@still/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

/**
 * Defensive cap for the exclusion set. Typical diaries are far smaller.
 * The query selects show ids only — never `tv.tmdb_json`.
 */
const LOGGED_TV_SHOW_ID_CAP = 5000;

/**
 * Every distinct show the patron has logged, including rows older than the
 * latest 400 that build the taste profile. Ten episodes of one show are one id.
 */
export async function fetchLoggedTvShowIds(userId: string): Promise<number[]> {
	const rows = await db
		.selectDistinct({ tvId: log.tvId })
		.from(log)
		.where(
			and(eq(log.userId, userId), isNull(log.removedAt), isNotNull(log.tvId)),
		)
		.limit(LOGGED_TV_SHOW_ID_CAP);

	return rows.flatMap((row) => (row.tvId == null ? [] : [row.tvId]));
}
