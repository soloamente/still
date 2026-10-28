import { db, movie, tv } from "@still/db";
import { eq } from "drizzle-orm";

function overviewFromTmdbJson(tmdbJson: unknown): string | null {
	if (tmdbJson == null || typeof tmdbJson !== "object") return null;
	const raw = (tmdbJson as { overview?: unknown }).overview;
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function pickListingOverview(
	column: string | null,
	tmdbJson: unknown,
): string | null {
	const fromColumn = column?.trim();
	if (fromColumn && fromColumn.length > 0) return fromColumn;
	return overviewFromTmdbJson(tmdbJson);
}

/** Plot synopsis for lobby heroes — DB column first, then cached TMDb JSON. */
export async function resolveMovieHeroOverview(
	tmdbId: number,
): Promise<string | null> {
	const [row] = await db
		.select({ overview: movie.overview, tmdbJson: movie.tmdbJson })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbId))
		.limit(1);
	return pickListingOverview(row?.overview ?? null, row?.tmdbJson);
}

export async function resolveTvHeroOverview(
	tmdbId: number,
): Promise<string | null> {
	const [row] = await db
		.select({ overview: tv.overview, tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbId))
		.limit(1);
	return pickListingOverview(row?.overview ?? null, row?.tmdbJson);
}
