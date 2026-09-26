import { logRatingToDisplay } from "@/lib/log-rating";

export type DiaryTvEpisodeLog = {
	id: string;
	logScope: "show" | "season" | "episode";
	seasonNumber: number | null;
	episodeNumber: number | null;
	/** Stored tenths, or null when the log has no rating. */
	rating: number | null;
	watchedAt: string;
};

export type DiaryTvPill =
	| { kind: "empty"; latestLogId: null; averageDisplay: null }
	| { kind: "neutral"; latestLogId: string; averageDisplay: null }
	| { kind: "rated"; latestLogId: string; averageDisplay: number };

export function pillForEpisode(
	episode: { seasonNumber: number; episodeNumber: number },
	logs: readonly DiaryTvEpisodeLog[],
): DiaryTvPill {
	const matches = logs.filter(
		(log) =>
			log.logScope === "episode" &&
			log.seasonNumber === episode.seasonNumber &&
			log.episodeNumber === episode.episodeNumber,
	);
	if (matches.length === 0) {
		return { kind: "empty", latestLogId: null, averageDisplay: null };
	}
	const latest = [...matches].sort((a, b) =>
		a.watchedAt < b.watchedAt ? 1 : -1,
	)[0];
	const rated = matches
		.map((log) => logRatingToDisplay(log.rating))
		.filter((value): value is number => value != null);
	if (rated.length === 0) {
		return { kind: "neutral", latestLogId: latest.id, averageDisplay: null };
	}
	const average = rated.reduce((sum, value) => sum + value, 0) / rated.length;
	return {
		kind: "rated",
		latestLogId: latest.id,
		averageDisplay: Math.round(average * 10) / 10,
	};
}
