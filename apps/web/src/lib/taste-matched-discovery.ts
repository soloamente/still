/** Mirrors `apps/server/src/lib/taste-matched-discovery.ts` for home rail UI. */

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
