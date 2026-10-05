import { db, tvWatch, tvWatchEpisode } from "@still/db";
import { eq } from "drizzle-orm";

import {
	computeNextEpisode,
	getTvSeasonDetailCached,
	getTvSeasonsCached,
} from "./tv-season-cache";
import {
	statusWhenCatalogComplete,
	statusWhenEpisodesRemain,
} from "./tv-watch-progress-status";

export type TvEpisodeKey = {
	seasonNumber: number;
	episodeNumber: number;
};

/** Catalogue order — every progress-tracked episode on the show. */
export async function listAllCatalogEpisodes(
	tvId: number,
	language: string,
): Promise<TvEpisodeKey[]> {
	const seasons = await getTvSeasonsCached(tvId, language);
	const episodes: TvEpisodeKey[] = [];
	for (const season of seasons) {
		const detail = await getTvSeasonDetailCached(
			tvId,
			season.season_number,
			language,
		);
		for (const ep of detail.episodes ?? []) {
			episodes.push({
				seasonNumber: ep.season_number,
				episodeNumber: ep.episode_number,
			});
		}
	}
	return episodes;
}

/**
 * Insert every catalogue episode for this watch row — used when the patron marks
 * the whole show finished.
 */
export async function markAllCatalogEpisodesWatched(
	tvWatchId: string,
	tvId: number,
	language: string,
): Promise<TvEpisodeKey | null> {
	const episodes = await listAllCatalogEpisodes(tvId, language);
	if (episodes.length === 0) return null;

	const chunkSize = 200;
	for (let i = 0; i < episodes.length; i += chunkSize) {
		const chunk = episodes.slice(i, i + chunkSize);
		await db
			.insert(tvWatchEpisode)
			.values(
				chunk.map((ep) => ({
					tvWatchId,
					seasonNumber: ep.seasonNumber,
					episodeNumber: ep.episodeNumber,
				})),
			)
			.onConflictDoNothing();
	}

	return episodes[episodes.length - 1] ?? null;
}

async function loadWatchedEpisodeKeys(
	tvWatchId: string,
): Promise<TvEpisodeKey[]> {
	const rows = await db
		.select({
			seasonNumber: tvWatchEpisode.seasonNumber,
			episodeNumber: tvWatchEpisode.episodeNumber,
		})
		.from(tvWatchEpisode)
		.where(eq(tvWatchEpisode.tvWatchId, tvWatchId));
	return rows.map((row) => ({
		seasonNumber: row.seasonNumber,
		episodeNumber: row.episodeNumber,
	}));
}

/**
 * After episode checkmarks change, align show status + continue pointer with
 * catalogue progress (all watched ⇒ finished; gap while finished ⇒ watching).
 */
export async function reconcileTvWatchProgress(
	watchRow: typeof tvWatch.$inferSelect,
	language: string,
): Promise<typeof tvWatch.$inferSelect> {
	const watched = await loadWatchedEpisodeKeys(watchRow.id);
	const next = await computeNextEpisode(watchRow.tvId, watched, language);

	let nextStatus = watchRow.status;
	let lastSeason = watchRow.lastSeason;
	let lastEpisode = watchRow.lastEpisode;

	if (next == null) {
		const catalog = await listAllCatalogEpisodes(watchRow.tvId, language);
		if (catalog.length > 0) {
			nextStatus = statusWhenCatalogComplete(watchRow.status);
			const last = catalog[catalog.length - 1];
			lastSeason = last.seasonNumber;
			lastEpisode = last.episodeNumber;
		}
	} else if (watchRow.status === "finished") {
		nextStatus = statusWhenEpisodesRemain(watchRow.status);
	}

	const statusChanged = nextStatus !== watchRow.status;
	const pointerChanged =
		lastSeason !== watchRow.lastSeason || lastEpisode !== watchRow.lastEpisode;

	if (!statusChanged && !pointerChanged) {
		return watchRow;
	}

	const [updated] = await db
		.update(tvWatch)
		.set({
			status: nextStatus,
			statusChangedAt: statusChanged ? new Date() : watchRow.statusChangedAt,
			lastSeason,
			lastEpisode,
		})
		.where(eq(tvWatch.id, watchRow.id))
		.returning();

	return updated ?? watchRow;
}
