import { db, movie, tv } from "@still/db";
import { inArray } from "drizzle-orm";

import {
	discoverQueryIncludesAnimeKeyword,
	warmTvAdultClassificationBatch,
} from "./adult-anime-classification";
import {
	filterOutAdultRows,
	isMovieAdult,
	isTmdbSummaryAdult,
	isTvAdultFromRow,
} from "./adult-content-policy";

/** Post-filter movie catalogue rows using TMDb summary + cached DB adult flags. */
export async function filterMovieCatalogueResults<
	T extends { id: number; adult?: boolean | null },
>(rows: T[], showAdultContent: boolean): Promise<T[]> {
	if (showAdultContent) return rows;
	const withoutTmdbAdult = filterOutAdultRows(rows, false, (row) =>
		isTmdbSummaryAdult(row),
	);
	if (withoutTmdbAdult.length === 0) return [];

	const ids = withoutTmdbAdult.map((row) => row.id);
	const cached = await db
		.select({ tmdbId: movie.tmdbId, adult: movie.adult })
		.from(movie)
		.where(inArray(movie.tmdbId, ids));
	const adultIds = new Set(
		cached.filter((row) => isMovieAdult(row)).map((row) => row.tmdbId),
	);
	return withoutTmdbAdult.filter((row) => !adultIds.has(row.id));
}

/** Post-filter TV catalogue rows; optionally warm MAL adult cache for anime discover. */
export async function filterTvCatalogueResults<
	T extends { id: number; adult?: boolean | null },
>(
	rows: T[],
	showAdultContent: boolean,
	opts?: { keywordIds?: number[] },
): Promise<T[]> {
	if (showAdultContent) return rows;
	const working = filterOutAdultRows(rows, false, (row) =>
		isTmdbSummaryAdult(row),
	);
	if (working.length === 0) return [];

	const shouldWarmMal = discoverQueryIncludesAnimeKeyword(opts?.keywordIds);
	if (shouldWarmMal) {
		await warmTvAdultClassificationBatch(working.slice(0, 20).map((r) => r.id));
	}

	const ids = working.map((row) => row.id);
	const cached = await db.select().from(tv).where(inArray(tv.tmdbId, ids));
	const adultIds = new Set(
		cached.filter((row) => isTvAdultFromRow(row)).map((row) => row.tmdbId),
	);
	return working.filter((row) => !adultIds.has(row.id));
}
