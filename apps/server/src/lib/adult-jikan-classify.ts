import type { StillAdultJson } from "./adult-content-policy";

const RX_RATING = "Rx - Hentai";

/** Map Jikan anime payload to adult classification signals. */
export function classifyJikanAnimeAdult(data: {
	rating?: string | null;
	genres?: { name?: string | null }[] | null;
}): { isAdult: boolean; sources: StillAdultJson["sources"] } {
	const sources: StillAdultJson["sources"] = [];
	if (data.rating === RX_RATING) sources.push("mal_rating");
	const hentai = (data.genres ?? []).some(
		(g) => g.name?.trim().toLowerCase() === "hentai",
	);
	if (hentai) sources.push("mal_genre");
	return { isAdult: sources.length > 0, sources };
}
