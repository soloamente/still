export type TvTitleScoreLog = {
	logScope?: string | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	rating: number | null;
};

export type TvScoreSource = "yours" | "average";

/** Official score for a show or season, plus the child average when you set your own. */
export type TvScorePresentation = {
	rating: number | null;
	source: TvScoreSource | null;
	/** Child rollup in stored tenths. Set only when your score exists and differs. */
	averageRating: number | null;
	averageCount: number;
};

function normalizeScope(
	scope: string | null | undefined,
): "show" | "season" | "episode" | "other" {
	if (scope == null || scope === "show") return "show";
	if (scope === "season") return "season";
	if (scope === "episode") return "episode";
	return "other";
}

export function meanStoredTenths(values: number[]): number | null {
	if (values.length === 0) return null;
	const sum = values.reduce((a, b) => a + b, 0);
	return Math.round(sum / values.length);
}

export function resolveTvSeasonScore(
	logs: readonly TvTitleScoreLog[],
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

const EMPTY_SCORE: TvScorePresentation = {
	rating: null,
	source: null,
	averageRating: null,
	averageCount: 0,
};

function ratedLogs(logs: readonly TvTitleScoreLog[]) {
	return logs.filter(
		(log): log is TvTitleScoreLog & { rating: number } => log.rating != null,
	);
}

function seasonNumbersWithScores(logs: readonly TvTitleScoreLog[]): number[] {
	const seasons = new Set<number>();
	for (const log of ratedLogs(logs)) {
		const scope = normalizeScope(log.logScope);
		if (
			(scope === "season" || scope === "episode") &&
			log.seasonNumber != null
		) {
			seasons.add(log.seasonNumber);
		}
	}
	return [...seasons].filter(
		(seasonNumber) => resolveTvSeasonScore(logs, seasonNumber) != null,
	);
}

function distinctRatedEpisodeCount(
	logs: readonly TvTitleScoreLog[],
	seasonNumber: number,
): number {
	const ids = new Set<string>();
	for (const [index, log] of ratedLogs(logs).entries()) {
		if (log.seasonNumber !== seasonNumber) continue;
		if (normalizeScope(log.logScope) !== "episode") continue;
		ids.add(
			log.episodeNumber != null ? String(log.episodeNumber) : `log-${index}`,
		);
	}
	return ids.size;
}

/**
 * Show score the page, watched list, and editor share.
 * A show log you rated wins. Otherwise the score is the average of the season scores.
 */
export function presentTvTitleScore(
	logs: readonly TvTitleScoreLog[],
): TvScorePresentation {
	const rated = ratedLogs(logs);
	const showRated = rated
		.filter((log) => normalizeScope(log.logScope) === "show")
		.map((log) => log.rating);
	const childLogs = rated.filter((log) => {
		const scope = normalizeScope(log.logScope);
		return scope === "season" || scope === "episode";
	});
	const seasons = seasonNumbersWithScores(childLogs);
	const average = resolveTvTitleScore(childLogs);
	if (showRated.length > 0) {
		const rating = meanStoredTenths(showRated);
		return {
			rating,
			source: "yours",
			averageRating: average != null && average !== rating ? average : null,
			averageCount: seasons.length,
		};
	}
	if (average == null) return EMPTY_SCORE;
	return {
		rating: average,
		source: "average",
		averageRating: null,
		averageCount: seasons.length,
	};
}

/**
 * Season score. A season log you rated wins.
 * Otherwise the score is the average of that season's rated episodes.
 */
export function presentTvSeasonScore(
	logs: readonly TvTitleScoreLog[],
	seasonNumber: number,
): TvScorePresentation {
	const inSeason = ratedLogs(logs).filter(
		(log) => log.seasonNumber === seasonNumber,
	);
	const seasonRated = inSeason
		.filter((log) => normalizeScope(log.logScope) === "season")
		.map((log) => log.rating);
	const episodeRated = inSeason
		.filter((log) => normalizeScope(log.logScope) === "episode")
		.map((log) => log.rating);
	const episodeMean = meanStoredTenths(episodeRated);
	const episodeCount = distinctRatedEpisodeCount(logs, seasonNumber);
	if (seasonRated.length > 0) {
		const rating = meanStoredTenths(seasonRated);
		return {
			rating,
			source: "yours",
			averageRating:
				episodeMean != null && episodeMean !== rating ? episodeMean : null,
			averageCount: episodeCount,
		};
	}
	if (episodeMean == null) return EMPTY_SCORE;
	return {
		rating: episodeMean,
		source: "average",
		averageRating: null,
		averageCount: episodeCount,
	};
}

export function resolveTvTitleScore(
	logs: readonly TvTitleScoreLog[],
): number | null {
	const rated = logs.filter((l) => l.rating != null) as Array<
		TvTitleScoreLog & { rating: number }
	>;
	const showRated = rated
		.filter((l) => normalizeScope(l.logScope) === "show")
		.map((l) => l.rating);
	if (showRated.length > 0) return meanStoredTenths(showRated);

	const seasons = new Set<number>();
	for (const l of rated) {
		const scope = normalizeScope(l.logScope);
		if ((scope === "season" || scope === "episode") && l.seasonNumber != null) {
			seasons.add(l.seasonNumber);
		}
	}
	const seasonScores: number[] = [];
	for (const sn of seasons) {
		const score = resolveTvSeasonScore(rated, sn);
		if (score != null) seasonScores.push(score);
	}
	return meanStoredTenths(seasonScores);
}

/**
 * Caption rating for one TV ledger tile — series/season means, episode keeps its row.
 * `allLogs` should be the patron's logs in the same ledger payload set (same title filters).
 */
export function ledgerDisplayRatingForTvLog(
	item: {
		tvId: number | null;
		logScope?: string | null;
		seasonNumber?: number | null;
		rating: number | null;
	},
	allLogs: Array<
		TvTitleScoreLog & {
			tvId: number | null;
		}
	>,
): number | null {
	if (item.tvId == null) return item.rating;
	const sameTitle = allLogs.filter((row) => row.tvId === item.tvId);
	const scope = normalizeScope(item.logScope);
	if (scope === "show") return resolveTvTitleScore(sameTitle);
	if (scope === "season" && item.seasonNumber != null) {
		return resolveTvSeasonScore(sameTitle, item.seasonNumber);
	}
	return item.rating;
}
