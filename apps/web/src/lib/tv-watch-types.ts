/** Mirrors `packages/db` — kept in web for labels without importing server code. */
export type TvLogScope = "show" | "season" | "episode";

export type TvWatchStatus =
	| "watching"
	| "paused"
	| "abandoned"
	| "finished"
	| "rewatching";

export type TvProgressMode = "season" | "episode";

export interface TvWatchRow {
	id: string;
	userId: string;
	tvId: number;
	status: TvWatchStatus;
	progressMode: TvProgressMode;
	lastSeason: number | null;
	lastEpisode: number | null;
	notifyNewEpisodes: boolean;
	startedAt: string;
	statusChangedAt: string;
}

export interface TvWatchEpisodeRow {
	seasonNumber: number;
	episodeNumber: number;
	watchedAt: string;
}

export interface TvWatchNextEpisode {
	seasonNumber: number;
	episodeNumber: number;
	episodeName?: string | null;
	airDate?: string | null;
}

export interface TvWatchShowSummary {
	tmdbId: number;
	title: string;
	posterPath: string | null;
}

/** `GET /api/tv-watch/me/by-tv/:tvId` and list rows. */
export interface TvWatchBundle {
	watch: TvWatchRow | null;
	show: TvWatchShowSummary | null;
	watchedEpisodes: TvWatchEpisodeRow[];
	nextEpisode: TvWatchNextEpisode | null;
}

export interface TvSeasonSummary {
	id: number;
	name: string;
	season_number: number;
	episode_count: number;
	poster_path?: string | null;
	air_date?: string | null;
}

export interface TvEpisodeSummary {
	id: number;
	name: string;
	season_number: number;
	episode_number: number;
	air_date?: string | null;
	still_path?: string | null;
	runtime?: number | null;
}

export const TV_WATCH_STATUS_LABELS: Record<TvWatchStatus, string> = {
	watching: "Watching",
	paused: "Paused",
	abandoned: "Abandoned",
	finished: "Finished",
	rewatching: "Rewatching",
};

export const TV_PROGRESS_MODE_LABELS: Record<TvProgressMode, string> = {
	season: "By season",
	episode: "By episode",
};
