import { db, tv } from "@still/db";
import { eq } from "drizzle-orm";

import {
	type TmdbEpisodeSummary,
	type TmdbSeasonDetail,
	type TmdbSeasonSummary,
	tmdbApi,
} from "./tmdb";

const SEASON_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type StillSeasonsCache = {
	syncedAt: string;
	seasons: TmdbSeasonSummary[];
};

type StillSeasonDetailCache = {
	syncedAt: string;
	seasonNumber: number;
	episodes: TmdbEpisodeSummary[];
};

type StillTvJsonExtras = {
	_stillSeasons?: StillSeasonsCache;
	_stillSeasonDetails?: Record<string, StillSeasonDetailCache>;
};

function isFresh(syncedAt: string | undefined): boolean {
	if (!syncedAt) return false;
	const t = Date.parse(syncedAt);
	if (!Number.isFinite(t)) return false;
	return Date.now() - t < SEASON_CACHE_TTL_MS;
}

function readExtras(tmdbJson: Record<string, unknown> | null | undefined) {
	return (tmdbJson ?? {}) as StillTvJsonExtras & Record<string, unknown>;
}

/** Patron-facing season rows (skip specials season 0 when empty). */
export function filterSeasonsForProgress(seasons: TmdbSeasonSummary[]) {
	return seasons
		.filter((s) => s.season_number > 0 && s.episode_count > 0)
		.sort((a, b) => a.season_number - b.season_number);
}

/**
 * Load season summaries for a show — cache under `tv.tmdbJson._stillSeasons` for 24h.
 */
export async function getTvSeasonsCached(
	tvId: number,
	language: string,
): Promise<TmdbSeasonSummary[]> {
	const [row] = await db
		.select({ tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tvId))
		.limit(1);

	const extras = readExtras(row?.tmdbJson ?? undefined);
	if (extras._stillSeasons && isFresh(extras._stillSeasons.syncedAt)) {
		return filterSeasonsForProgress(extras._stillSeasons.seasons);
	}

	const payload = await tmdbApi.tvSeasons(tvId, { language });
	const seasons = filterSeasonsForProgress(payload.seasons ?? []);
	const merged: Record<string, unknown> = {
		...(row?.tmdbJson ?? {}),
		_stillSeasons: {
			syncedAt: new Date().toISOString(),
			seasons,
		} satisfies StillSeasonsCache,
	};

	await db
		.update(tv)
		.set({ tmdbJson: merged, lastSyncedAt: new Date() })
		.where(eq(tv.tmdbId, tvId));

	return seasons;
}

/**
 * Load one season’s episodes — cache per season under `tv.tmdbJson._stillSeasonDetails`.
 */
export async function getTvSeasonDetailCached(
	tvId: number,
	seasonNumber: number,
	language: string,
): Promise<TmdbSeasonDetail> {
	const [row] = await db
		.select({ tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tvId))
		.limit(1);

	const extras = readExtras(row?.tmdbJson ?? undefined);
	const key = String(seasonNumber);
	const cached = extras._stillSeasonDetails?.[key];
	if (cached && isFresh(cached.syncedAt)) {
		return {
			...cached,
			id: cached.seasonNumber,
			name: `Season ${cached.seasonNumber}`,
			poster_path: null,
			episode_count: cached.episodes.length,
			season_number: cached.seasonNumber,
			episodes: cached.episodes,
		};
	}

	const detail = await tmdbApi.tvSeasonDetail(tvId, seasonNumber, {
		language,
	});
	const episodes = (detail.episodes ?? []).sort(
		(a, b) => a.episode_number - b.episode_number,
	);
	const entry: StillSeasonDetailCache = {
		syncedAt: new Date().toISOString(),
		seasonNumber,
		episodes,
	};
	const merged: Record<string, unknown> = {
		...(row?.tmdbJson ?? {}),
		_stillSeasonDetails: {
			...(extras._stillSeasonDetails ?? {}),
			[key]: entry,
		},
	};

	await db
		.update(tv)
		.set({ tmdbJson: merged, lastSyncedAt: new Date() })
		.where(eq(tv.tmdbId, tvId));

	return { ...detail, episodes };
}

export interface NextEpisodePointer {
	seasonNumber: number;
	episodeNumber: number;
	episodeName?: string | null;
	airDate?: string | null;
}

/**
 * First unwatched episode in broadcast order — used for “Next: S02E04” and mark-next CTA.
 */
export async function computeNextEpisode(
	tvId: number,
	watched: { seasonNumber: number; episodeNumber: number }[],
	language: string,
): Promise<NextEpisodePointer | null> {
	const watchedSet = new Set(
		watched.map((w) => `${w.seasonNumber}:${w.episodeNumber}`),
	);
	const seasons = await getTvSeasonsCached(tvId, language);

	for (const season of seasons) {
		const detail = await getTvSeasonDetailCached(
			tvId,
			season.season_number,
			language,
		);
		for (const ep of detail.episodes) {
			const key = `${ep.season_number}:${ep.episode_number}`;
			if (!watchedSet.has(key)) {
				return {
					seasonNumber: ep.season_number,
					episodeNumber: ep.episode_number,
					episodeName: ep.name ?? null,
					airDate: ep.air_date ?? null,
				};
			}
		}
	}
	return null;
}
