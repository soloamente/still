/** Structured Max playback. The show name is what TMDb should match. */
export function maxWatchFromPlayback(input: {
	showTitle: string | null | undefined;
	isMovie: boolean;
	season: number | null | undefined;
	episode: number | null | undefined;
}): {
	provider: "max";
	kind: "movie" | "episode";
	title: string;
	season: number | null;
	episode: number | null;
} | null {
	const title = input.showTitle?.trim() ?? "";
	if (!title) return null;

	const season =
		typeof input.season === "number" && input.season >= 1 ? input.season : null;
	const episode =
		typeof input.episode === "number" && input.episode >= 1
			? input.episode
			: null;
	const isEpisode = !input.isMovie && season != null && episode != null;

	return {
		provider: "max",
		kind: isEpisode ? "episode" : "movie",
		title,
		season: isEpisode ? season : null,
		episode: isEpisode ? episode : null,
	};
}
