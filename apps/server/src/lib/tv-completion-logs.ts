import { db, eventLog, log } from "@still/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { visibilityForAutoLog } from "./auto-log-visibility";
import { makeId } from "./cuid";
import { invalidateCommunityStatsForDiaryLog } from "./listing-community-stats-cache";
import {
	type CompletionSeason,
	latestWatchedAt,
	planCompletionLogs,
	type WatchedEpisodeKey,
} from "./tv-completion-core";
import { getTvSeasonDetailCached, getTvSeasonsCached } from "./tv-season-cache";

export type SyncTvCompletionOptions = {
	userId: string;
	tvId: number;
	language: string;
	/** Checked-off episodes (`watchedAt` only matters for `dating: "history"`). */
	watched: ReadonlyArray<WatchedEpisodeKey>;
	/** `now` = date logs today (live use); `history` = date from check-marks (backfill). */
	dating?: "now" | "history";
	/** Report what would be created without writing. */
	dryRun?: boolean;
};

export type SyncTvCompletionResult = {
	seasonLogsCreated: number[];
	showLogCreated: boolean;
};

/**
 * Catalogue seasons with their episode numbers. Seasons with nothing checked
 * cannot be complete, so they skip the season-detail fetch and get a synthetic
 * 1..N list from the summary episode_count.
 */
async function loadCompletionSeasons(
	tvId: number,
	language: string,
	watched: ReadonlyArray<WatchedEpisodeKey>,
): Promise<CompletionSeason[]> {
	const summaries = await getTvSeasonsCached(tvId, language);
	const watchedSeasons = new Set(watched.map((w) => w.seasonNumber));
	const seasons: CompletionSeason[] = [];
	for (const summary of summaries) {
		if (!watchedSeasons.has(summary.season_number)) {
			seasons.push({
				seasonNumber: summary.season_number,
				episodeNumbers: Array.from(
					{ length: summary.episode_count },
					(_, i) => i + 1,
				),
			});
			continue;
		}
		const detail = await getTvSeasonDetailCached(
			tvId,
			summary.season_number,
			language,
		);
		seasons.push({
			seasonNumber: summary.season_number,
			episodeNumbers: (detail.episodes ?? []).map((ep) => ep.episode_number),
		});
	}
	return seasons;
}

async function insertCompletionLog(args: {
	userId: string;
	tvId: number;
	scope: "season" | "show";
	seasonNumber: number | null;
	watchedAt: Date;
	visibility: "public" | "followers" | "friends" | "private";
}): Promise<void> {
	const id = makeId("log");
	await db.insert(log).values({
		id,
		userId: args.userId,
		movieId: null,
		tvId: args.tvId,
		watchedAt: args.watchedAt,
		rating: null,
		liked: false,
		rewatch: false,
		note: null,
		containsSpoilers: false,
		watchVenue: "streaming",
		logScope: args.scope,
		seasonNumber: args.seasonNumber,
		episodeNumber: null,
		visibility: args.visibility,
	});
	await db.insert(eventLog).values({
		id: makeId("evt"),
		userId: args.userId,
		kind: "log.created",
		payload: { logId: id, tvId: args.tvId, source: "tv-completion" },
	});
}

/**
 * After check-marks change: create the season diary log for every fully checked
 * season, and the whole-show log once every season is finished. Idempotent;
 * never deletes anything (un-checking leaves existing logs alone).
 * Never throws — a failure here must not break check-off.
 */
export async function syncTvCompletionLogs(
	opts: SyncTvCompletionOptions,
): Promise<SyncTvCompletionResult | null> {
	try {
		const empty: SyncTvCompletionResult = {
			seasonLogsCreated: [],
			showLogCreated: false,
		};
		if (opts.watched.length === 0) return empty;

		const seasons = await loadCompletionSeasons(
			opts.tvId,
			opts.language,
			opts.watched,
		);

		const existing = await db
			.select({ logScope: log.logScope, seasonNumber: log.seasonNumber })
			.from(log)
			.where(
				and(
					eq(log.userId, opts.userId),
					eq(log.tvId, opts.tvId),
					isNull(log.removedAt),
					inArray(log.logScope, ["season", "show"]),
				),
			);
		const seasonsWithLog = new Set<number>();
		let hasShowLog = false;
		for (const row of existing) {
			if (row.logScope === "show") hasShowLog = true;
			if (row.logScope === "season" && row.seasonNumber != null) {
				seasonsWithLog.add(row.seasonNumber);
			}
		}

		const plan = planCompletionLogs({
			seasons,
			watched: opts.watched,
			seasonsWithLog,
			hasShowLog,
		});
		const result: SyncTvCompletionResult = {
			seasonLogsCreated: plan.seasonLogsToCreate,
			showLogCreated: plan.showLogToCreate,
		};
		if (
			opts.dryRun ||
			(plan.seasonLogsToCreate.length === 0 && !plan.showLogToCreate)
		) {
			return result;
		}

		const visibility = await visibilityForAutoLog(opts.userId);
		const now = new Date();
		const history = opts.dating === "history";

		for (const seasonNumber of plan.seasonLogsToCreate) {
			await insertCompletionLog({
				userId: opts.userId,
				tvId: opts.tvId,
				scope: "season",
				seasonNumber,
				watchedAt: history
					? (latestWatchedAt(opts.watched, seasonNumber) ?? now)
					: now,
				visibility,
			});
		}
		if (plan.showLogToCreate) {
			await insertCompletionLog({
				userId: opts.userId,
				tvId: opts.tvId,
				scope: "show",
				seasonNumber: null,
				watchedAt: history ? (latestWatchedAt(opts.watched) ?? now) : now,
				visibility,
			});
		}

		// Community score / ranks read cached snapshots — drop them after diary writes.
		void invalidateCommunityStatsForDiaryLog({
			movieId: null,
			tvId: opts.tvId,
		}).catch(() => {});

		return result;
	} catch (error) {
		console.error("[tv-completion] sync failed", error);
		return null;
	}
}
