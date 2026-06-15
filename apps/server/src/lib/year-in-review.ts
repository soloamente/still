import { db, log, movie, review, tv } from "@still/db";
import { and, eq, gte, isNull, lt } from "drizzle-orm";

import { utcDateKeyFromWatchedAt } from "./activity-signature";
import { reviewRatingToDisplay } from "./review-rating";
import { decadeFromYear } from "./taste-scoring-math";
import { longestStreakFromDayKeys } from "./watch-streak";

/** Minimum diary logs in a UTC calendar year before Wrapped is shown. */
export const YEAR_IN_REVIEW_MIN_LOGS = 5;

const TMDB_GENRE_NAMES: Record<number, string> = {
	28: "Action",
	12: "Adventure",
	16: "Animation",
	35: "Comedy",
	80: "Crime",
	99: "Documentary",
	18: "Drama",
	10751: "Family",
	14: "Fantasy",
	36: "History",
	27: "Horror",
	10402: "Music",
	9648: "Mystery",
	10749: "Romance",
	878: "Science Fiction",
	10770: "TV Movie",
	53: "Thriller",
	10752: "War",
	37: "Western",
};

export type YearInReviewTopTitle = {
	kind: "movie" | "tv";
	tmdbId: number;
	title: string;
	posterPath: string | null;
	year: number | null;
	/** Patron score on 0–10 display scale. */
	rating: number | null;
	watchedAt: string;
};

export type YearInReviewGenreStat = {
	genreId: number;
	label: string;
	count: number;
};

/**
 * Year in Review / Wrapped payload — computed on demand from diary + reviews.
 *
 * `eligible` is false when `totalLogs` &lt; {@link YEAR_IN_REVIEW_MIN_LOGS}.
 * All stats use UTC boundaries on `log.watchedAt` / `review.publishedAt`.
 */
export type YearInReviewPayload = {
	year: number;
	eligible: boolean;
	totalLogs: number;
	averageRating: number | null;
	topGenres: YearInReviewGenreStat[];
	/** Release decade with the most logs, e.g. `2010` for the 2010s. */
	topDecade: number | null;
	/** UTC calendar month 1–12 with the most diary activity. */
	busiestMonth: number | null;
	topTitles: YearInReviewTopTitle[];
	longestStreakInYear: number;
	reviewCount: number;
};

export type YearInReviewLogRow = {
	watchedAt: Date;
	rating: number | null;
	movieId: number | null;
	tvId: number | null;
	title: string;
	posterPath: string | null;
	releaseYear: number | null;
	genreIds: number[];
};

function genreDisplayLabel(id: number): string {
	return TMDB_GENRE_NAMES[id] ?? "Film";
}

function listingKey(row: YearInReviewLogRow): string {
	if (row.movieId != null) return `movie:${row.movieId}`;
	if (row.tvId != null) return `tv:${row.tvId}`;
	return `unknown:${row.title}`;
}

function utcYearWindow(year: number): { start: Date; end: Date } {
	return {
		start: new Date(`${year}-01-01T00:00:00.000Z`),
		end: new Date(`${year + 1}-01-01T00:00:00.000Z`),
	};
}

function dayKeysInYear(logs: YearInReviewLogRow[], year: number): string[] {
	const prefix = `${year}-`;
	return [
		...new Set(
			logs
				.map((row) => utcDateKeyFromWatchedAt(row.watchedAt))
				.filter((key) => key.startsWith(prefix)),
		),
	];
}

function topGenresFromLogs(
	logs: YearInReviewLogRow[],
): YearInReviewGenreStat[] {
	const counts = new Map<number, number>();
	for (const row of logs) {
		for (const genreId of row.genreIds) {
			counts.set(genreId, (counts.get(genreId) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0] - b[0])
		.slice(0, 3)
		.map(([genreId, count]) => ({
			genreId,
			label: genreDisplayLabel(genreId),
			count,
		}));
}

function topDecadeFromLogs(logs: YearInReviewLogRow[]): number | null {
	const counts = new Map<number, number>();
	for (const row of logs) {
		const decade = decadeFromYear(row.releaseYear);
		if (decade == null) continue;
		counts.set(decade, (counts.get(decade) ?? 0) + 1);
	}
	let best: number | null = null;
	let bestCount = 0;
	for (const [decade, count] of counts) {
		if (count > bestCount || (count === bestCount && (best ?? 0) < decade)) {
			best = decade;
			bestCount = count;
		}
	}
	return best;
}

function busiestMonthFromLogs(logs: YearInReviewLogRow[]): number | null {
	const counts = new Map<number, number>();
	for (const row of logs) {
		const month = row.watchedAt.getUTCMonth() + 1;
		counts.set(month, (counts.get(month) ?? 0) + 1);
	}
	let best: number | null = null;
	let bestCount = 0;
	for (const [month, count] of counts) {
		if (count > bestCount) {
			best = month;
			bestCount = count;
		}
	}
	return best;
}

function averageRatingFromLogs(logs: YearInReviewLogRow[]): number | null {
	const rated = logs
		.map((row) => row.rating)
		.filter((rating): rating is number => rating != null);
	if (rated.length === 0) return null;
	const sum = rated.reduce(
		(total, stored) => total + reviewRatingToDisplay(stored),
		0,
	);
	return Math.round((sum / rated.length) * 10) / 10;
}

function topTitlesFromLogs(logs: YearInReviewLogRow[]): YearInReviewTopTitle[] {
	const bestByListing = new Map<string, YearInReviewLogRow>();
	for (const row of logs) {
		const key = listingKey(row);
		const prev = bestByListing.get(key);
		if (!prev) {
			bestByListing.set(key, row);
			continue;
		}
		const prevRating = prev.rating ?? -1;
		const nextRating = row.rating ?? -1;
		if (
			nextRating > prevRating ||
			(nextRating === prevRating &&
				row.watchedAt.getTime() > prev.watchedAt.getTime())
		) {
			bestByListing.set(key, row);
		}
	}

	return [...bestByListing.values()]
		.sort((a, b) => {
			const ratingA = a.rating ?? -1;
			const ratingB = b.rating ?? -1;
			if (ratingB !== ratingA) return ratingB - ratingA;
			return b.watchedAt.getTime() - a.watchedAt.getTime();
		})
		.slice(0, 5)
		.map((row) => ({
			kind: row.movieId != null ? ("movie" as const) : ("tv" as const),
			tmdbId: row.movieId ?? row.tvId ?? 0,
			title: row.title,
			posterPath: row.posterPath,
			year: row.releaseYear,
			rating: row.rating != null ? reviewRatingToDisplay(row.rating) : null,
			watchedAt: row.watchedAt.toISOString(),
		}));
}

function emptyPayload(
	year: number,
	totalLogs: number,
	reviewCount: number,
): YearInReviewPayload {
	return {
		year,
		eligible: false,
		totalLogs,
		averageRating: null,
		topGenres: [],
		topDecade: null,
		busiestMonth: null,
		topTitles: [],
		longestStreakInYear: 0,
		reviewCount,
	};
}

/** Pure compute — used by tests and the DB fetcher. */
export function computeYearInReviewFromRows(
	year: number,
	input: { logs: YearInReviewLogRow[]; reviewCount: number },
): YearInReviewPayload {
	const logs = input.logs;
	const totalLogs = logs.length;
	if (totalLogs < YEAR_IN_REVIEW_MIN_LOGS) {
		return emptyPayload(year, totalLogs, input.reviewCount);
	}

	return {
		year,
		eligible: true,
		totalLogs,
		averageRating: averageRatingFromLogs(logs),
		topGenres: topGenresFromLogs(logs),
		topDecade: topDecadeFromLogs(logs),
		busiestMonth: busiestMonthFromLogs(logs),
		topTitles: topTitlesFromLogs(logs),
		longestStreakInYear: longestStreakFromDayKeys(dayKeysInYear(logs, year)),
		reviewCount: input.reviewCount,
	};
}

export function parseYearInReviewYear(raw: string): number | null {
	const year = Number.parseInt(raw, 10);
	if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
	return year;
}

/** Load diary + review rows for a patron year, then compute Wrapped stats. */
export async function fetchYearInReviewForUser(
	userId: string,
	year: number,
): Promise<YearInReviewPayload> {
	const { start, end } = utcYearWindow(year);

	const [logRows, reviewRows] = await Promise.all([
		db
			.select({
				watchedAt: log.watchedAt,
				rating: log.rating,
				movieId: log.movieId,
				tvId: log.tvId,
				movieTitle: movie.title,
				tvTitle: tv.title,
				moviePoster: movie.posterPath,
				tvPoster: tv.posterPath,
				movieYear: movie.year,
				tvYear: tv.year,
				movieGenres: movie.genreIds,
				tvGenres: tv.genreIds,
			})
			.from(log)
			.leftJoin(movie, eq(log.movieId, movie.tmdbId))
			.leftJoin(tv, eq(log.tvId, tv.tmdbId))
			.where(
				and(
					eq(log.userId, userId),
					isNull(log.removedAt),
					gte(log.watchedAt, start),
					lt(log.watchedAt, end),
				),
			),
		db
			.select({ id: review.id })
			.from(review)
			.where(
				and(
					eq(review.userId, userId),
					isNull(review.removedAt),
					gte(review.publishedAt, start),
					lt(review.publishedAt, end),
				),
			),
	]);

	const logs: YearInReviewLogRow[] = logRows.map((row) => ({
		watchedAt: row.watchedAt,
		rating: row.rating,
		movieId: row.movieId,
		tvId: row.tvId,
		title: row.movieTitle ?? row.tvTitle ?? "Untitled",
		posterPath: row.moviePoster ?? row.tvPoster ?? null,
		releaseYear: row.movieYear ?? row.tvYear ?? null,
		genreIds: [
			...((row.movieGenres as number[] | undefined) ?? []),
			...((row.tvGenres as number[] | undefined) ?? []),
		],
	}));

	return computeYearInReviewFromRows(year, {
		logs,
		reviewCount: reviewRows.length,
	});
}
