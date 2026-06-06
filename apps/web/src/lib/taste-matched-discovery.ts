/** Mirrors `apps/server/src/lib/taste-matched-discovery.ts` for home rail UI. */

/** Minimum visible taste-rail titles (ST.4) — hide section below this count. */
export const TASTE_MATCH_MIN_RESULTS = 6;

export type TasteMatchMovie = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	year: number | null;
};

export type TasteMatchedDiscoveryPayload = {
	coldStart: boolean;
	genrePhrase: string | null;
	movies: TasteMatchMovie[];
};

export function tasteMatchedRailTitle(genrePhrase: string | null): string {
	if (genrePhrase?.trim()) {
		return `Because you gravitate toward ${genrePhrase}`;
	}
	return "Because of your taste";
}
