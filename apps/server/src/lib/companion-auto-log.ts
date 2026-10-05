import {
	db,
	eventLog,
	log,
	profile,
	tvWatch,
	tvWatchEpisode,
	user,
} from "@still/db";
import { and, asc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { CompanionNowWatchingView } from "./companion-now-watching";
import { syncCompletionistChallengesForUser } from "./completionist-challenge-sync";
import { makeId } from "./cuid";
import { ensureMovieCached } from "./ensure-movie-cached";
import { invalidateCommunityStatsForDiaryLog } from "./listing-community-stats-cache";
import { recomputeUserTasteSignature } from "./recompute-user-taste-signature";
import { recordProductEvent } from "./record-product-event";
import { syncLinkedReviewRatingFromLog } from "./sync-linked-review-rating";
import { getTmdbLanguageForUser } from "./tmdb-poster-language";
import { ensureTvCached } from "./tv-cache";
import {
	listAllCatalogEpisodes,
	reconcileTvWatchProgress,
} from "./tv-watch-progress-sync";
import { syncWatchStreakForUser } from "./watch-streak-sync";
import { invalidateWatchlistTonightSocial } from "./watchlist-tonight-signals";
import { clearWatchlistItemForUserTitle } from "./watchlist-upsert";

/** Credits usually start around here. Shorter than this is a trailer or a preview. */
export const COMPANION_AUTO_LOG_RATIO = 0.9;
export const COMPANION_AUTO_LOG_MIN_DURATION_SEC = 10 * 60;

/**
 * Heartbeats continue after the diary row exists. Skip the same title for
 * twelve hours so the credits do not write a second row.
 */
export const COMPANION_AUTO_LOG_WINDOW_MS = 12 * 60 * 60 * 1000;

const recentLoggedAt = new Map<string, number>();
const inflight = new Map<string, Promise<CompanionAutoLogResult | null>>();

/** What the watching toast needs after a diary row is written. */
export type CompanionAutoLogResult = {
	logId: string;
	title: string;
	kind: "movie" | "tv";
	season: number | null;
	episode: number | null;
	/** This episode is the last one in the show's catalogue. */
	seriesFinale: boolean;
};

export const companionLogRatingBody = z.object({
	logId: z.string().trim().min(1).max(80),
	rating: z.number().min(0).max(10),
});

/** Slider value on the 0–10 display scale, stored as tenths. */
export function companionDisplayRatingToStored(display: number): number | null {
	if (!Number.isFinite(display) || display < 0 || display > 10) return null;
	return Math.round(display * 10);
}

/**
 * A movie score is the latest diary row. An episode rewatch should change the
 * existing episode score, so a second rated row is not averaged in.
 */
export function companionRatingTarget(input: {
	kind: "movie" | "tv";
	logId: string;
	earlierLogId: string | null;
}): string {
	if (input.kind === "tv" && input.earlierLogId) return input.earlierLogId;
	return input.logId;
}

export function resetCompanionAutoLogMemory(): void {
	recentLoggedAt.clear();
	inflight.clear();
}

type PlaybackSnapshot = {
	kind: "movie" | "tv";
	tmdbId: number | null;
	season: number | null;
	episode: number | null;
	positionSec: number | null;
	durationSec: number | null;
};

/** Stable id for one film, or one episode. Position is not part of it. */
export function companionAutoLogKey(
	userId: string,
	view: Pick<PlaybackSnapshot, "kind" | "tmdbId" | "season" | "episode">,
): string | null {
	if (view.tmdbId == null) return null;
	if (view.kind === "movie") return `${userId}:movie:${view.tmdbId}`;
	if (view.kind === "tv") {
		if (view.season == null || view.episode == null) return null;
		if (view.season < 1 || view.episode < 1) return null;
		return `${userId}:tv:${view.tmdbId}:${view.season}:${view.episode}`;
	}
	const neverKind: never = view.kind;
	return neverKind;
}

/**
 * True once the playhead is in the last tenth of a real runtime.
 * A missing TMDb match, a missing episode number, or a short clip stays out.
 */
export function companionPlaybackReadyToLog(input: PlaybackSnapshot): boolean {
	if (companionAutoLogKey("ready", input) == null) return false;
	const position = input.positionSec;
	const duration = input.durationSec;
	if (position == null || duration == null) return false;
	if (!Number.isFinite(position) || !Number.isFinite(duration)) return false;
	if (duration < COMPANION_AUTO_LOG_MIN_DURATION_SEC) return false;
	if (position < 0) return false;
	// A broken player can report a position far past the runtime.
	if (position > duration + 30) return false;
	return position / duration >= COMPANION_AUTO_LOG_RATIO;
}

export function companionAutoLogRecentlyRecorded(
	key: string,
	now: number,
): boolean {
	const at = recentLoggedAt.get(key);
	if (at == null) return false;
	if (now - at >= COMPANION_AUTO_LOG_WINDOW_MS) {
		recentLoggedAt.delete(key);
		return false;
	}
	return true;
}

export function rememberCompanionAutoLog(key: string, now: number): void {
	recentLoggedAt.set(key, now);
}

/**
 * One diary row when playback crosses the threshold. Later heartbeats for the
 * same film or episode return null until the window expires.
 */
export async function recordCompanionAutoLog(
	userId: string,
	view: CompanionNowWatchingView,
): Promise<CompanionAutoLogResult | null> {
	const key = companionAutoLogKey(userId, view);
	if (!key || !companionPlaybackReadyToLog(view)) return null;
	if (companionAutoLogRecentlyRecorded(key, Date.now())) return null;
	const pending = inflight.get(key);
	if (pending) return pending;
	const work = writeCompanionAutoLog(userId, view, key);
	inflight.set(key, work);
	try {
		return await work;
	} finally {
		inflight.delete(key);
	}
}

async function writeCompanionAutoLog(
	userId: string,
	view: CompanionNowWatchingView,
	key: string,
): Promise<CompanionAutoLogResult | null> {
	const tmdbId = view.tmdbId;
	if (tmdbId == null) return null;

	const since = new Date(Date.now() - COMPANION_AUTO_LOG_WINDOW_MS);
	const titleWhere =
		view.kind === "movie"
			? eq(log.movieId, tmdbId)
			: and(
					eq(log.tvId, tmdbId),
					eq(log.logScope, "episode"),
					eq(log.seasonNumber, view.season ?? -1),
					eq(log.episodeNumber, view.episode ?? -1),
				);

	const [recent] = await db
		.select({ id: log.id })
		.from(log)
		.where(
			and(
				eq(log.userId, userId),
				isNull(log.removedAt),
				gte(log.watchedAt, since),
				titleWhere,
			),
		)
		.limit(1);
	if (recent) {
		rememberCompanionAutoLog(key, Date.now());
		return null;
	}

	const [older] = await db
		.select({ id: log.id, rating: log.rating })
		.from(log)
		.where(and(eq(log.userId, userId), isNull(log.removedAt), titleWhere))
		.limit(1);
	// First diary row ever (any title) — for product analytics only; rating lives on `older`.
	let anyPrior: { id: string } | null = older ? { id: older.id } : null;
	if (!anyPrior) {
		const [row] = await db
			.select({ id: log.id })
			.from(log)
			.where(eq(log.userId, userId))
			.limit(1);
		anyPrior = row ?? null;
	}

	if (view.kind === "movie") {
		try {
			await ensureMovieCached(tmdbId);
		} catch (error) {
			console.error("[companion] movie cache failed", error);
			return null;
		}
	} else {
		const cached = await ensureTvCached(tmdbId);
		if (!cached) return null;
	}

	const visibility = await visibilityForAutoLog(userId);
	const id = makeId("log");
	const watchedAt = new Date();
	await db.insert(log).values({
		id,
		userId,
		movieId: view.kind === "movie" ? tmdbId : null,
		tvId: view.kind === "tv" ? tmdbId : null,
		watchedAt,
		// Movies show the latest diary row. Carry the previous score so this
		// rewatch does not blank it before a new rating is chosen.
		rating: view.kind === "movie" ? (older?.rating ?? null) : null,
		liked: false,
		rewatch: older != null,
		note: null,
		containsSpoilers: false,
		watchVenue: "streaming",
		logScope: view.kind === "tv" ? "episode" : "show",
		seasonNumber: view.kind === "tv" ? view.season : null,
		episodeNumber: view.kind === "tv" ? view.episode : null,
		visibility,
	});

	await db.insert(eventLog).values({
		id: makeId("evt"),
		userId,
		kind: "log.created",
		payload: {
			logId: id,
			movieId: view.kind === "movie" ? tmdbId : undefined,
			tvId: view.kind === "tv" ? tmdbId : undefined,
			source: "companion",
		},
	});

	let seriesFinale = false;
	if (view.kind === "movie") {
		await clearWatchlistItemForUserTitle(userId, { movieId: tmdbId });
		invalidateWatchlistTonightSocial(userId);
	} else if (view.season != null && view.episode != null) {
		try {
			seriesFinale = await markCompanionEpisode(
				userId,
				tmdbId,
				view.season,
				view.episode,
			);
		} catch (error) {
			console.error("[companion] episode check failed", error);
		}
	}

	void recomputeUserTasteSignature(userId).catch((error: unknown) => {
		console.error("[companion] taste recompute failed", error);
	});
	void syncWatchStreakForUser(userId, watchedAt).catch((error: unknown) => {
		console.error("[companion] watch streak sync failed", error);
	});
	if (view.kind === "movie") {
		void syncCompletionistChallengesForUser(userId).catch((error: unknown) => {
			console.error("[companion] completionist sync failed", error);
		});
	}
	void invalidateCommunityStatsForDiaryLog({
		movieId: view.kind === "movie" ? tmdbId : null,
		tvId: view.kind === "tv" ? tmdbId : null,
	}).catch(() => {});
	void db
		.execute(
			sql`UPDATE profile SET stats_cache = jsonb_set(COALESCE(stats_cache, '{}'), '{logCount}', to_jsonb(COALESCE((stats_cache->>'logCount')::int, 0) + 1)) WHERE user_id = ${userId}`,
		)
		.catch(() => {});

	if (!anyPrior) {
		void recordProductEvent(userId, "log.first_created", {
			movieId: view.kind === "movie" ? tmdbId : undefined,
			tvId: view.kind === "tv" ? tmdbId : undefined,
		});
	}

	rememberCompanionAutoLog(key, Date.now());
	return {
		logId: id,
		title: view.title,
		kind: view.kind,
		season: view.kind === "tv" ? view.season : null,
		episode: view.kind === "tv" ? view.episode : null,
		seriesFinale,
	};
}

/** Save a score on the diary row this playback just created. */
export async function rateCompanionAutoLog(
	userId: string,
	logId: string,
	ratingTenths: number,
): Promise<boolean> {
	if (
		!Number.isInteger(ratingTenths) ||
		ratingTenths < 0 ||
		ratingTenths > 100
	) {
		return false;
	}
	const stored = ratingTenths;
	const [row] = await db
		.select({
			id: log.id,
			userId: log.userId,
			movieId: log.movieId,
			tvId: log.tvId,
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
			episodeNumber: log.episodeNumber,
		})
		.from(log)
		.where(
			and(eq(log.id, logId), eq(log.userId, userId), isNull(log.removedAt)),
		)
		.limit(1);
	if (!row) return false;

	let earlierLogId: string | null = null;
	if (
		row.tvId != null &&
		row.logScope === "episode" &&
		row.seasonNumber != null &&
		row.episodeNumber != null
	) {
		const [earlier] = await db
			.select({ id: log.id })
			.from(log)
			.where(
				and(
					eq(log.userId, userId),
					eq(log.tvId, row.tvId),
					eq(log.logScope, "episode"),
					eq(log.seasonNumber, row.seasonNumber),
					eq(log.episodeNumber, row.episodeNumber),
					isNull(log.removedAt),
					ne(log.id, row.id),
				),
			)
			.orderBy(asc(log.watchedAt))
			.limit(1);
		earlierLogId = earlier?.id ?? null;
	}

	const targetId = companionRatingTarget({
		kind: row.movieId != null ? "movie" : "tv",
		logId: row.id,
		earlierLogId,
	});
	await db.update(log).set({ rating: stored }).where(eq(log.id, targetId));
	await syncLinkedReviewRatingFromLog(targetId, stored);
	await invalidateCommunityStatsForDiaryLog({
		movieId: row.movieId,
		tvId: row.tvId,
	});
	return true;
}

/**
 * Public logs require a verified email. An unverified account still gets the
 * diary row, saved as private, so the heartbeat is never rejected.
 */
async function visibilityForAutoLog(
	userId: string,
): Promise<"public" | "followers" | "friends" | "private"> {
	const [own] = await db
		.select({ visibility: profile.defaultVisibility })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	const visibility = own?.visibility ?? "public";
	if (visibility !== "public") return visibility;
	if (process.env.NODE_ENV === "development") return visibility;
	const [account] = await db
		.select({ emailVerified: user.emailVerified })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (account?.emailVerified === true) return visibility;
	return "private";
}

/** Check off the episode and let continue-watching move to the next one. */
async function markCompanionEpisode(
	userId: string,
	tvId: number,
	seasonNumber: number,
	episodeNumber: number,
): Promise<boolean> {
	const [existing] = await db
		.select()
		.from(tvWatch)
		.where(and(eq(tvWatch.userId, userId), eq(tvWatch.tvId, tvId)))
		.limit(1);

	let watchId = existing?.id;
	if (!watchId) {
		watchId = makeId("tvw");
		await db.insert(tvWatch).values({
			id: watchId,
			userId,
			tvId,
			status: "watching",
			progressMode: "episode",
			notifyNewEpisodes: true,
		});
	}

	await db
		.insert(tvWatchEpisode)
		.values({ tvWatchId: watchId, seasonNumber, episodeNumber })
		.onConflictDoNothing();

	const [updated] = await db
		.update(tvWatch)
		.set({ lastSeason: seasonNumber, lastEpisode: episodeNumber })
		.where(eq(tvWatch.id, watchId))
		.returning();
	if (!updated) return false;

	const language = await getTmdbLanguageForUser(userId);
	await reconcileTvWatchProgress(updated, language);
	try {
		const catalog = await listAllCatalogEpisodes(tvId, language);
		const last = catalog[catalog.length - 1];
		return (
			last != null &&
			last.seasonNumber === seasonNumber &&
			last.episodeNumber === episodeNumber
		);
	} catch (error) {
		console.error("[companion] series finale check failed", error);
		return false;
	}
}
