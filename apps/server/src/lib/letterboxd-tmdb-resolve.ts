import { db, movie } from "@still/db";
import { and, eq, ilike } from "drizzle-orm";

import { tmdbApi } from "./tmdb";

export type LetterboxdTmdbSearchCandidate = {
	id?: number;
	release_date?: string;
};

export type LetterboxdTmdbSearch = (
	query: string,
	page?: number,
	year?: number | null,
) => Promise<{ results?: LetterboxdTmdbSearchCandidate[] }>;

/** Extract calendar year from a TMDb `release_date` (`YYYY-MM-DD`). */
export function releaseYearFromTmdbDate(
	releaseDate: string | undefined,
): number | null {
	if (!releaseDate || releaseDate.length < 4) return null;
	const year = Number.parseInt(releaseDate.slice(0, 4), 10);
	return Number.isFinite(year) ? year : null;
}

/**
 * Pick the best TMDb movie id from search results for a Letterboxd title row.
 * Letterboxd years often reflect wide/streaming release while TMDb uses theatrical
 * dates — allow ±1 year before giving up.
 */
export function pickLetterboxdTmdbCandidate(
	candidates: LetterboxdTmdbSearchCandidate[],
	year: number | null,
): number | null {
	if (candidates.length === 0) return null;
	if (year == null) return candidates[0]?.id ?? null;

	const exact = candidates.find(
		(c) => releaseYearFromTmdbDate(c.release_date) === year,
	);
	if (exact?.id != null) return exact.id;

	const near = candidates.find((c) => {
		const releaseYear = releaseYearFromTmdbDate(c.release_date);
		return releaseYear != null && Math.abs(releaseYear - year) <= 1;
	});
	if (near?.id != null) return near.id;

	return candidates[0]?.id ?? null;
}

function letterboxdResolveCacheKey(name: string, year: number | null): string {
	return `${name.trim().toLowerCase()}\u0000${year ?? ""}`;
}

/** In-memory memo for one import batch — avoids duplicate TMDb calls per title. */
export function createMemoizedLetterboxdTmdbResolver(
	resolve: (
		name: string,
		year: number | null,
	) => Promise<number | null> = resolveLetterboxdMovieTmdbId,
): (name: string, year: number | null) => Promise<number | null> {
	const cache = new Map<string, number | null>();
	return async (name, year) => {
		const key = letterboxdResolveCacheKey(name, year);
		if (cache.has(key)) return cache.get(key) ?? null;
		const id = await resolve(name, year);
		cache.set(key, id);
		return id;
	};
}

async function searchLetterboxdOnTmdb(
	name: string,
	year: number | null,
	searchMovies: LetterboxdTmdbSearch,
): Promise<number | null> {
	// TMDb `year` keeps the intended film ranked first even when `release_date`
	// is the prior calendar year — re-filtering by date prefix picks making-of docs.
	if (year != null) {
		const withYear = await searchMovies(name, 1, year);
		const yearFiltered = withYear.results ?? [];
		if (yearFiltered.length > 0) {
			return yearFiltered[0]?.id ?? null;
		}
	}

	const broad = await searchMovies(name, 1, null);
	return pickLetterboxdTmdbCandidate(broad.results ?? [], year);
}

/**
 * Resolve a Letterboxd film row to a TMDb movie id — DB title/year cache first,
 * then TMDb search fallback (same strategy as the original import route).
 */
export async function resolveLetterboxdMovieTmdbId(
	name: string,
	year: number | null,
	deps?: { searchMovies?: LetterboxdTmdbSearch },
): Promise<number | null> {
	const trimmedName = name.trim();
	if (!trimmedName) return null;

	if (year != null) {
		const [byYear] = await db
			.select({ tmdbId: movie.tmdbId })
			.from(movie)
			.where(and(ilike(movie.title, trimmedName), eq(movie.year, year)))
			.limit(1);
		if (byYear) return byYear.tmdbId;

		// Cached titles may differ by one year from Letterboxd exports.
		for (const driftYear of [year - 1, year + 1]) {
			const [byNearYear] = await db
				.select({ tmdbId: movie.tmdbId })
				.from(movie)
				.where(and(ilike(movie.title, trimmedName), eq(movie.year, driftYear)))
				.limit(1);
			if (byNearYear) return byNearYear.tmdbId;
		}
	}

	const [byTitle] = await db
		.select({ tmdbId: movie.tmdbId, year: movie.year })
		.from(movie)
		.where(ilike(movie.title, trimmedName))
		.limit(1);
	if (byTitle) {
		if (
			year == null ||
			byTitle.year == null ||
			Math.abs(byTitle.year - year) <= 1
		) {
			return byTitle.tmdbId;
		}
	}

	const searchMovies =
		deps?.searchMovies ??
		(async (query, page, searchYear) =>
			tmdbApi.searchMovies(query, page ?? 1, { year: searchYear }));

	try {
		return await searchLetterboxdOnTmdb(trimmedName, year, searchMovies);
	} catch (err) {
		console.error("[letterboxd-tmdb-resolve] TMDb search failed", err);
		return null;
	}
}
