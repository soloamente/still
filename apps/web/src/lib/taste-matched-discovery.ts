/** Mirrors `apps/server/src/lib/taste-matched-discovery.ts` for home rail UI. */

/** Minimum visible taste-rail titles (ST.4) — hide section below this count. */
export const TASTE_MATCH_MIN_RESULTS = 6;

/** Maximum in-memory taste queue depth — re-exported from queue helpers. */
export { TASTE_MATCH_TARGET_RESULTS } from "./taste-match-queue";

export type TasteMatchMovie = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	backdropPath?: string | null;
	year: number | null;
	communityAverage?: number | null;
	communityRatingsCount?: number;
	trailerKey?: string | null;
	trailerSite?: string | null;
	festivalIcon?: string | null;
	logoPath?: string | null;
};

export type TasteMatchedDiscoveryPayload = {
	coldStart: boolean;
	genrePhrase: string | null;
	movies: TasteMatchMovie[];
	/** Watchlist ∪ diary ids from `GET /api/taste/for-you` for client reconciliation. */
	consumedTmdbIds?: number[];
};

export function tasteMatchedRailTitle(genrePhrase: string | null): string {
	if (genrePhrase?.trim()) {
		return `Because you gravitate toward ${genrePhrase}`;
	}
	return "Because of your taste";
}

/** Client-side guard — mirrors server filter when RSC payload is stale. */
export function reconcileTasteMatchMovies(
	movies: TasteMatchMovie[],
	consumedTmdbIds?: number[],
): TasteMatchMovie[] {
	if (!consumedTmdbIds?.length) return movies;
	const consumed = new Set(consumedTmdbIds);
	return movies.filter((row) => !consumed.has(row.tmdbId));
}
