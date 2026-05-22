import { db, notification, tv, tvWatch, tvWatchEpisode } from "@still/db";
import { and, eq, inArray, sql } from "drizzle-orm";

import { makeId } from "../lib/cuid";
import {
	getTvSeasonDetailCached,
	getTvSeasonsCached,
} from "../lib/tv-season-cache";

/** Background sync uses a stable catalogue language — patron UI still uses profile locale. */
const SYNC_LANGUAGE = "en-US";

/** Notify when an episode’s `air_date` falls within this many days (inclusive). */
const AIRED_WINDOW_DAYS = 21;

export function isTvEpisodeSyncEnabled(): boolean {
	return process.env.TV_EPISODE_SYNC_ENABLED !== "false";
}

function parseAirDate(airDate: string | null | undefined): Date | null {
	if (!airDate?.trim()) return null;
	const d = new Date(`${airDate.trim()}T12:00:00Z`);
	return Number.isFinite(d.getTime()) ? d : null;
}

/** True when the episode has aired recently enough to warrant a bell stub. */
function airedRecently(airDate: string | null | undefined): boolean {
	const d = parseAirDate(airDate);
	if (!d) return false;
	const now = Date.now();
	const cutoff = now - AIRED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	const aired = d.getTime();
	return aired <= now && aired >= cutoff;
}

function episodeCode(seasonNumber: number, episodeNumber: number): string {
	return `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
}

async function notificationExists(
	userId: string,
	tvId: number,
	seasonNumber: number,
	episodeNumber: number,
): Promise<boolean> {
	const [row] = await db
		.select({ id: notification.id })
		.from(notification)
		.where(
			and(
				eq(notification.userId, userId),
				eq(notification.kind, "tv.new_episode"),
				sql`(${notification.payload}->>'tvId')::int = ${tvId}`,
				sql`(${notification.payload}->>'seasonNumber')::int = ${seasonNumber}`,
				sql`(${notification.payload}->>'episodeNumber')::int = ${episodeNumber}`,
			),
		)
		.limit(1);
	return Boolean(row);
}

/**
 * Daily/hourly job — inserts `tv.new_episode` rows for patrons who follow a show
 * and have notifications enabled. Dedupes per user + episode via payload keys.
 */
export async function syncTvNewEpisodeNotifications(): Promise<void> {
	if (!isTvEpisodeSyncEnabled()) return;

	const watches = await db
		.select()
		.from(tvWatch)
		.where(
			and(
				inArray(tvWatch.status, ["watching", "rewatching"]),
				eq(tvWatch.notifyNewEpisodes, true),
			),
		);

	for (const watch of watches) {
		try {
			await notifyNewEpisodesForWatch(watch);
		} catch (err) {
			console.error(`[tv-new-episode] watch=${watch.id} tv=${watch.tvId}`, err);
		}
	}
}

async function notifyNewEpisodesForWatch(
	watch: typeof tvWatch.$inferSelect,
): Promise<void> {
	const watchedRows = await db
		.select({
			seasonNumber: tvWatchEpisode.seasonNumber,
			episodeNumber: tvWatchEpisode.episodeNumber,
		})
		.from(tvWatchEpisode)
		.where(eq(tvWatchEpisode.tvWatchId, watch.id));
	const watchedSet = new Set(
		watchedRows.map((w) => `${w.seasonNumber}:${w.episodeNumber}`),
	);

	const [show] = await db
		.select({ title: tv.title })
		.from(tv)
		.where(eq(tv.tmdbId, watch.tvId))
		.limit(1);
	const showTitle = show?.title?.trim() ?? "Series";

	const seasons = await getTvSeasonsCached(watch.tvId, SYNC_LANGUAGE);

	for (const season of seasons) {
		const detail = await getTvSeasonDetailCached(
			watch.tvId,
			season.season_number,
			SYNC_LANGUAGE,
		);
		for (const ep of detail.episodes ?? []) {
			const key = `${ep.season_number}:${ep.episode_number}`;
			if (watchedSet.has(key)) continue;
			if (!airedRecently(ep.air_date)) continue;

			const seasonNumber = ep.season_number;
			const episodeNumber = ep.episode_number;
			if (
				await notificationExists(
					watch.userId,
					watch.tvId,
					seasonNumber,
					episodeNumber,
				)
			) {
				continue;
			}

			const code = episodeCode(seasonNumber, episodeNumber);
			const epName = ep.name?.trim();
			await db.insert(notification).values({
				id: makeId("ntf"),
				userId: watch.userId,
				kind: "tv.new_episode",
				title: `New episode · ${showTitle}`,
				body: epName ? `${code} · ${epName}` : code,
				payload: {
					tvId: watch.tvId,
					seasonNumber,
					episodeNumber,
					showTitle,
					href: `/tv/${watch.tvId}#tv-section-progress`,
				},
			});

			// One stub per show per sync pass — avoids flooding when catching up on a backlog.
			return;
		}
	}
}
