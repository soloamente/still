/**
 * Pure rules for "is this season / series finished?" — no database access so
 * the logic stays unit-testable. `tv-completion-logs.ts` feeds it real data.
 */

/** One catalogue season and the episode numbers TMDb lists for it. */
export type CompletionSeason = {
	seasonNumber: number;
	episodeNumbers: readonly number[];
};

/** A checked-off episode; `watchedAt` is only needed for backfill dating. */
export type WatchedEpisodeKey = {
	seasonNumber: number;
	episodeNumber: number;
	watchedAt?: Date;
};

/** Logs that should exist but do not yet. */
export type CompletionPlan = {
	seasonLogsToCreate: number[];
	showLogToCreate: boolean;
};

function episodeKey(seasonNumber: number, episodeNumber: number): string {
	return `${seasonNumber}:${episodeNumber}`;
}

/** Seasons (regular, > 0) whose every catalogue episode is checked off. */
export function completedSeasonNumbers(
	seasons: readonly CompletionSeason[],
	watched: ReadonlyArray<WatchedEpisodeKey>,
): number[] {
	const checked = new Set(
		watched.map((w) => episodeKey(w.seasonNumber, w.episodeNumber)),
	);
	return seasons
		.filter(
			(s) =>
				s.seasonNumber > 0 &&
				s.episodeNumbers.length > 0 &&
				s.episodeNumbers.every((n) =>
					checked.has(episodeKey(s.seasonNumber, n)),
				),
		)
		.map((s) => s.seasonNumber);
}

/**
 * Which season / whole-show diary logs are now due.
 * - A season is due when it is fully checked off and has no season log yet.
 * - A season that already has a season log (e.g. logged by hand) counts as
 *   finished for the series check even without check-marks.
 * - The whole-show log is due when every regular season is finished and no
 *   whole-show log exists.
 */
export function planCompletionLogs(input: {
	seasons: readonly CompletionSeason[];
	watched: ReadonlyArray<WatchedEpisodeKey>;
	seasonsWithLog: ReadonlySet<number>;
	hasShowLog: boolean;
}): CompletionPlan {
	const checkComplete = completedSeasonNumbers(input.seasons, input.watched);
	const seasonLogsToCreate = checkComplete.filter(
		(n) => !input.seasonsWithLog.has(n),
	);

	const finished = new Set<number>([...checkComplete, ...input.seasonsWithLog]);
	const regular = input.seasons.filter(
		(s) => s.seasonNumber > 0 && s.episodeNumbers.length > 0,
	);
	const allFinished =
		regular.length > 0 && regular.every((s) => finished.has(s.seasonNumber));

	return {
		seasonLogsToCreate,
		showLogToCreate: allFinished && !input.hasShowLog,
	};
}

/**
 * Newest `watchedAt` among checked episodes — one season when `seasonNumber`
 * is given, the whole show otherwise. Used to date backfilled logs.
 */
export function latestWatchedAt(
	watched: ReadonlyArray<WatchedEpisodeKey>,
	seasonNumber?: number,
): Date | null {
	let latest: Date | null = null;
	for (const row of watched) {
		if (seasonNumber != null && row.seasonNumber !== seasonNumber) continue;
		if (!row.watchedAt) continue;
		if (latest == null || row.watchedAt.getTime() > latest.getTime()) {
			latest = row.watchedAt;
		}
	}
	return latest;
}
