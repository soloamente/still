import { formatStoredLogRatingDisplay } from "@/lib/log-rating";

/**
 * Same rollup as `apps/server/src/lib/tv-title-score.ts`.
 * A score you saved on the show or season stays. The average fills in only when you did not.
 */

export type TvScoreLog = {
	logScope?: string | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	/** Diary rows may omit `rating` when unset. */
	rating?: number | null;
};

export type TvScoreSource = "yours" | "average";

export type TvScorePresentation = {
	rating: number | null;
	source: TvScoreSource | null;
	averageRating: number | null;
	averageCount: number;
};

const EMPTY_SCORE: TvScorePresentation = {
	rating: null,
	source: null,
	averageRating: null,
	averageCount: 0,
};

function normalizeScope(
	scope: string | null | undefined,
): "show" | "season" | "episode" | "other" {
	if (scope == null || scope === "show") return "show";
	if (scope === "season") return "season";
	if (scope === "episode") return "episode";
	return "other";
}

function meanStoredTenths(values: number[]): number | null {
	if (values.length === 0) return null;
	const sum = values.reduce((total, value) => total + value, 0);
	return Math.round(sum / values.length);
}

function resolveTvSeasonScore(
	logs: readonly TvScoreLog[],
	seasonNumber: number,
): number | null {
	const seasonScoped: number[] = [];
	const episodeScoped: number[] = [];
	for (const log of logs) {
		if (log.rating == null || log.seasonNumber !== seasonNumber) continue;
		const scope = normalizeScope(log.logScope);
		if (scope === "season") seasonScoped.push(log.rating);
		else if (scope === "episode") episodeScoped.push(log.rating);
	}
	if (seasonScoped.length > 0) return meanStoredTenths(seasonScoped);
	return meanStoredTenths(episodeScoped);
}

function resolveTvTitleScore(logs: readonly TvScoreLog[]): number | null {
	const rated = logs.filter(
		(log): log is TvScoreLog & { rating: number } => log.rating != null,
	);
	const showRated = rated
		.filter((log) => normalizeScope(log.logScope) === "show")
		.map((log) => log.rating);
	if (showRated.length > 0) return meanStoredTenths(showRated);
	const seasons = new Set<number>();
	for (const log of rated) {
		const scope = normalizeScope(log.logScope);
		if (
			(scope === "season" || scope === "episode") &&
			log.seasonNumber != null
		) {
			seasons.add(log.seasonNumber);
		}
	}
	const seasonScores: number[] = [];
	for (const seasonNumber of seasons) {
		const score = resolveTvSeasonScore(rated, seasonNumber);
		if (score != null) seasonScores.push(score);
	}
	return meanStoredTenths(seasonScores);
}

function seasonCount(logs: readonly TvScoreLog[]): number {
	const seasons = new Set<number>();
	for (const log of logs) {
		if (log.rating == null || log.seasonNumber == null) continue;
		const scope = normalizeScope(log.logScope);
		if (scope !== "season" && scope !== "episode") continue;
		if (resolveTvSeasonScore(logs, log.seasonNumber) != null) {
			seasons.add(log.seasonNumber);
		}
	}
	return seasons.size;
}

function episodeCount(
	logs: readonly TvScoreLog[],
	seasonNumber: number,
): number {
	const ids = new Set<string>();
	for (const [index, log] of logs.entries()) {
		if (log.rating == null || log.seasonNumber !== seasonNumber) continue;
		if (normalizeScope(log.logScope) !== "episode") continue;
		ids.add(
			log.episodeNumber != null ? String(log.episodeNumber) : `log-${index}`,
		);
	}
	return ids.size;
}

export function presentTvTitleScore(
	logs: readonly TvScoreLog[],
): TvScorePresentation {
	const showRated = logs
		.filter(
			(log): log is TvScoreLog & { rating: number } =>
				log.rating != null && normalizeScope(log.logScope) === "show",
		)
		.map((log) => log.rating);
	const childLogs = logs.filter((log) => {
		const scope = normalizeScope(log.logScope);
		return scope === "season" || scope === "episode";
	});
	const average = resolveTvTitleScore(childLogs);
	const count = seasonCount(childLogs);
	if (showRated.length > 0) {
		const rating = meanStoredTenths(showRated);
		return {
			rating,
			source: "yours",
			averageRating: average != null && average !== rating ? average : null,
			averageCount: count,
		};
	}
	if (average == null) return EMPTY_SCORE;
	return {
		rating: average,
		source: "average",
		averageRating: null,
		averageCount: count,
	};
}

export function presentTvSeasonScore(
	logs: readonly TvScoreLog[],
	seasonNumber: number,
): TvScorePresentation {
	const inSeason = logs.filter(
		(log): log is TvScoreLog & { rating: number } =>
			log.rating != null && log.seasonNumber === seasonNumber,
	);
	const seasonRated = inSeason
		.filter((log) => normalizeScope(log.logScope) === "season")
		.map((log) => log.rating);
	const episodeRated = inSeason
		.filter((log) => normalizeScope(log.logScope) === "episode")
		.map((log) => log.rating);
	const episodeMean = meanStoredTenths(episodeRated);
	const count = episodeCount(logs, seasonNumber);
	if (seasonRated.length > 0) {
		const rating = meanStoredTenths(seasonRated);
		return {
			rating,
			source: "yours",
			averageRating:
				episodeMean != null && episodeMean !== rating ? episodeMean : null,
			averageCount: count,
		};
	}
	if (episodeMean == null) return EMPTY_SCORE;
	return {
		rating: episodeMean,
		source: "average",
		averageRating: null,
		averageCount: count,
	};
}

/**
 * Where the log slider should open: the child average, with the average label.
 * Null when there is no child average to sit on.
 */
export function tvEditorAverageSeed(
	kind: "show" | "season",
	presentation: TvScorePresentation,
): { stored: number; label: string } | null {
	const stored =
		presentation.source === "yours" && presentation.averageRating != null
			? presentation.averageRating
			: presentation.rating;
	if (stored == null || presentation.averageCount < 1) return null;
	const label = tvScoreSourceLabel(kind, {
		rating: stored,
		source: "average",
		averageRating: null,
		averageCount: presentation.averageCount,
	});
	if (label == null) return null;
	return { stored, label };
}

/** Line under the official number: Your rating, or Average of N seasons/episodes. */
export function tvScoreSourceLabel(
	kind: "show" | "season",
	presentation: TvScorePresentation,
): string | null {
	if (presentation.source === "yours") return "Your rating";
	if (presentation.source !== "average" || presentation.averageCount < 1) {
		return null;
	}
	const count = presentation.averageCount;
	if (kind === "show") {
		return count === 1 ? "Average of 1 season" : `Average of ${count} seasons`;
	}
	return count === 1 ? "Average of 1 episode" : `Average of ${count} episodes`;
}

/** Quieter line when a score you saved differs from the child average. */
export function tvScoreAverageAside(
	kind: "show" | "season",
	presentation: TvScorePresentation,
): string | null {
	if (presentation.source !== "yours" || presentation.averageRating == null) {
		return null;
	}
	const label = formatStoredLogRatingDisplay(presentation.averageRating);
	if (label == null) return null;
	return kind === "show"
		? `Seasons average ${label}`
		: `Episodes average ${label}`;
}

/**
 * Note beside the log slider.
 * Shown when a child average exists, including while composing a show or season log.
 */
export function tvChildAverageNote(
	kind: "show" | "season",
	presentation: TvScorePresentation,
): string | null {
	const stored =
		presentation.source === "yours"
			? presentation.averageRating
			: presentation.source === "average"
				? presentation.rating
				: null;
	if (stored == null) return null;
	const label = formatStoredLogRatingDisplay(stored);
	if (label == null) return null;
	return kind === "show"
		? `Seasons average ${label}`
		: `Episodes average ${label}`;
}
