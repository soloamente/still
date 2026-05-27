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

export function formatTvSeasonDiaryCount(count: number): string | null {
	if (count <= 0) return null;
	return count === 1 ? "1 log" : `${count} logs`;
}
