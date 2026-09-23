import { db, log } from "@still/db";
import { and, eq, gte, isNull, lt } from "drizzle-orm";

import {
	startOfPatronWeek,
	summarizeTodayWeekPulse,
	type TodayWeekPulse,
} from "./today-week-pulse";

const DAY_MS = 86_400_000;

/**
 * Viewer's own diary logs for the patron-TZ week. The UTC window is padded by a
 * day each side (DST / offset drift); `summarizeTodayWeekPulse` trims to the week.
 */
export async function fetchTodayWeekPulse(
	userId: string,
	timeZone: string,
	now = new Date(),
): Promise<TodayWeekPulse> {
	const weekStart = startOfPatronWeek(now, timeZone);
	const from = new Date(weekStart.getTime() - DAY_MS);
	const to = new Date(weekStart.getTime() + 8 * DAY_MS);

	const rows = await db
		.select({
			watchedAt: log.watchedAt,
			rating: log.rating,
			movieId: log.movieId,
			tvId: log.tvId,
		})
		.from(log)
		.where(
			and(
				eq(log.userId, userId),
				isNull(log.removedAt),
				gte(log.watchedAt, from),
				lt(log.watchedAt, to),
			),
		);

	return summarizeTodayWeekPulse(rows, timeZone, now);
}
