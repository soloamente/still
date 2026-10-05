import { getTvSeasonDetailCached } from "./tv-season-cache";

const COMPANION_PROFILE_EPISODE_LANG = "en-US";

/** Episode name for the profile row — client first, then TMDb season cache. */
export async function resolveCompanionEpisodeTitle(input: {
	tmdbId: number | null;
	season: number | null;
	episode: number | null;
	episodeTitle?: string | null;
}): Promise<string | null> {
	const fromClient = input.episodeTitle?.trim();
	if (fromClient) return fromClient;
	if (input.tmdbId == null || input.season == null || input.episode == null) {
		return null;
	}
	if (input.season < 1 || input.episode < 1) return null;
	try {
		const detail = await getTvSeasonDetailCached(
			input.tmdbId,
			input.season,
			COMPANION_PROFILE_EPISODE_LANG,
		);
		const row = detail.episodes.find(
			(ep) => ep.episode_number === input.episode,
		);
		const name = row?.name?.trim();
		return name && name.length > 0 ? name : null;
	} catch {
		return null;
	}
}
