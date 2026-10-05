/** Season and episode from an Apple TV+ player subtitle. Movies have neither. */
export function parseAppleTvEpisode(subtitle: string | null | undefined): {
	season: number | null;
	episode: number | null;
} {
	const text = subtitle?.trim() ?? "";
	if (!text) return { season: null, episode: null };

	const short = text.match(/S\s*(\d+)\s*[,:]?\s*E\s*(\d+)/i);
	if (short?.[1] && short[2]) {
		return { season: Number(short[1]), episode: Number(short[2]) };
	}

	const season = text.match(/Season\s+(\d+)/i);
	const episode = text.match(/Ep(?:isode)?\.?\s*(\d+)/i);
	if (season?.[1] && episode?.[1]) {
		return { season: Number(season[1]), episode: Number(episode[1]) };
	}

	return { season: null, episode: null };
}
