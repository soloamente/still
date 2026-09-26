import { formatLogRatingDisplay, logRatingToDisplay } from "@/lib/log-rating";

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

export function initialSeasonNumber(
	logs: readonly DiaryTvEpisodeLog[],
	catalogueSeasonNumbers: readonly number[],
): number | null {
	const episodes = logs
		.filter((log) => log.logScope === "episode" && log.seasonNumber != null)
		.sort((a, b) => (a.watchedAt < b.watchedAt ? 1 : -1));
	if (episodes[0]?.seasonNumber != null) return episodes[0].seasonNumber;
	return catalogueSeasonNumbers[0] ?? null;
}

function latestScopeLog(
	logs: readonly DiaryTvEpisodeLog[],
): DiaryTvEpisodeLog | null {
	if (logs.length === 0) return null;
	return [...logs].sort((a, b) => (a.watchedAt < b.watchedAt ? 1 : -1))[0];
}

function scopeLabel(
	prefix: string,
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	const latest = latestScopeLog(logs);
	if (latest == null) return null;
	const display = logRatingToDisplay(latest.rating);
	if (display == null) return prefix;
	return `${prefix} · ${formatLogRatingDisplay(display)}`;
}

/**
 * Score for a header that already prints the season name.
 * Null when that season has no log, or the latest season log is unrated.
 */
export function seasonLogScoreLabel(
	seasonNumber: number,
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	const latest = latestScopeLog(
		logs.filter(
			(log) => log.logScope === "season" && log.seasonNumber === seasonNumber,
		),
	);
	if (latest == null) return null;
	const display = logRatingToDisplay(latest.rating);
	if (display == null) return null;
	return formatLogRatingDisplay(display);
}

export function showLogLabel(
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	return scopeLabel(
		"Whole series",
		logs.filter((log) => log.logScope === "show"),
	);
}

export function seasonLogLabel(
	seasonNumber: number,
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	return scopeLabel(
		`Season ${seasonNumber}`,
		logs.filter(
			(log) => log.logScope === "season" && log.seasonNumber === seasonNumber,
		),
	);
}
