import { db, log, movie, tv } from "@still/db";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { movieNotAdultSql, tvNotAdultSql } from "./adult-content-sql";
import {
	type DiaryMedia,
	type DiaryWatchPeriods,
	diaryDecadesFromYears,
} from "./diary-log-query";

/**
 * Distinct calendar years (and derived decades) from `log.watchedAt` for diary
 * period chips — scoped to the active Movies / TV ledger tab.
 */
export async function fetchDiaryWatchPeriods(
	userId: string,
	media: DiaryMedia,
	showAdultContent: boolean,
): Promise<DiaryWatchPeriods> {
	const baseWhere = and(eq(log.userId, userId), isNull(log.removedAt));

	const yearExpr = sql<number>`extract(year from ${log.watchedAt})::int`;

	if (media === "movie") {
		const rows = await db
			.select({ y: yearExpr })
			.from(log)
			.innerJoin(movie, eq(log.movieId, movie.tmdbId))
			.where(
				and(
					baseWhere,
					isNotNull(log.movieId),
					movieNotAdultSql(showAdultContent),
				),
			)
			.groupBy(yearExpr)
			.orderBy(desc(yearExpr));

		const years = rows.map((r) => r.y).filter((y) => Number.isInteger(y));
		return { years, decades: diaryDecadesFromYears(years) };
	}

	const rows = await db
		.select({ y: yearExpr })
		.from(log)
		.innerJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(and(baseWhere, isNotNull(log.tvId), tvNotAdultSql(showAdultContent)))
		.groupBy(yearExpr)
		.orderBy(desc(yearExpr));

	const years = rows.map((r) => r.y).filter((y) => Number.isInteger(y));
	return { years, decades: diaryDecadesFromYears(years) };
}
