export type TvTitleScoreLog = {
	logScope?: string | null;
	seasonNumber?: number | null;
	rating: number | null;
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
	logs: TvTitleScoreLog[],
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

export function resolveTvTitleScore(logs: TvTitleScoreLog[]): number | null {
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
