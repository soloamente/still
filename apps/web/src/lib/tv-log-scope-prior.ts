import type { MyTvLog } from "@/lib/my-tv-log";
import type { TvLogScope } from "@/lib/tv-watch-types";

/** Scope target for matching diary rows on one TV show. */
export type TvLogScopeTarget = {
	logScope: TvLogScope;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
};

function normalizeLogScope(scope: TvLogScope | null | undefined): TvLogScope {
	return scope ?? "show";
}

/** Whether a stored log row matches the scope being logged or displayed. */
export function tvLogMatchesScope(
	log: Pick<MyTvLog, "logScope" | "seasonNumber" | "episodeNumber">,
	target: TvLogScopeTarget,
): boolean {
	const logScope = normalizeLogScope(log.logScope);
	if (target.logScope === "show") {
		return logScope === "show";
	}
	if (target.logScope === "season") {
		return logScope === "season" && log.seasonNumber === target.seasonNumber;
	}
	return (
		logScope === "episode" &&
		log.seasonNumber === target.seasonNumber &&
		log.episodeNumber === target.episodeNumber
	);
}

export function countTvLogsInScope(
	logs: MyTvLog[],
	target: TvLogScopeTarget,
): number {
	return logs.filter((log) => tvLogMatchesScope(log, target)).length;
}

/** `myLogs` is newest-first from `GET /api/logs/me/by-tv/:id`. */
export function findLatestTvLogInScope(
	logs: MyTvLog[],
	target: TvLogScopeTarget,
): MyTvLog | null {
	return logs.find((log) => tvLogMatchesScope(log, target)) ?? null;
}

/**
 * Whole-show diary row is due when the series is finished, every season that
 * has episodes already has a season log, and no show log exists yet.
 */
export function seriesReadyForShowDiary(input: {
	status: string | null | undefined;
	seasons: ReadonlyArray<{ season_number: number; episode_count: number }>;
	logs: MyTvLog[];
}): boolean {
	if (input.status !== "finished") return false;
	if (countTvLogsInScope(input.logs, { logScope: "show" }) > 0) return false;
	const seasonsWithEpisodes = input.seasons.filter(
		(season) => season.episode_count > 0,
	);
	if (seasonsWithEpisodes.length === 0) return false;
	return seasonsWithEpisodes.every(
		(season) =>
			countTvLogsInScope(input.logs, {
				logScope: "season",
				seasonNumber: season.season_number,
			}) > 0,
	);
}

export function formatTvSeasonDiaryCount(count: number): string | null {
	if (count <= 0) return null;
	return count === 1 ? "1 log" : `${count} logs`;
}
