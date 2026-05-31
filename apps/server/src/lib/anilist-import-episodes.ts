import type { TmdbEpisodeSummary } from "./tmdb";

export interface EpisodeSlot {
	seasonNumber: number;
	episodeNumber: number;
}

/**
 * Flatten season episode lists in broadcast order (season asc, episode asc).
 * Skips season 0 when other seasons exist — matches `filterSeasonsForProgress`.
 */
export function flattenSeasonEpisodes(
	seasons: { seasonNumber: number; episodes: TmdbEpisodeSummary[] }[],
): EpisodeSlot[] {
	const positive = seasons.filter((s) => s.seasonNumber > 0);
	const use = positive.length > 0 ? positive : seasons;
	const sorted = [...use].sort((a, b) => a.seasonNumber - b.seasonNumber);
	const out: EpisodeSlot[] = [];
	for (const season of sorted) {
		const eps = [...season.episodes].sort(
			(a, b) => a.episode_number - b.episode_number,
		);
		for (const ep of eps) {
			out.push({
				seasonNumber: ep.season_number,
				episodeNumber: ep.episode_number,
			});
		}
	}
	return out;
}

/** First N episode slots in broadcast order — used for Anilist `progress` import. */
export function episodeSlotsForProgressCount(
	seasons: { seasonNumber: number; episodes: TmdbEpisodeSummary[] }[],
	progress: number,
): EpisodeSlot[] {
	if (progress <= 0) return [];
	const flat = flattenSeasonEpisodes(seasons);
	return flat.slice(0, progress);
}
