import { db, tv } from "@still/db";
import { eq, sql } from "drizzle-orm";
import {
	type AnilistImportMedia,
	anilistMediaSearchQueries,
} from "./anilist-import-json";
import {
	fetchAnilistMediaTitles,
	mergeAnilistMediaTitles,
} from "./anilist-media-titles";
import { fetchMalAnimeSearchTitles } from "./mal-anime-titles";
import { type TmdbTvSummary, tmdbApi } from "./tmdb";

const TMDB_ANIMATION_GENRE_ID = 16;

/** Import matching always uses these — not the patron catalogue locale (it-IT etc.). */
const TMDB_IMPORT_SEARCH_LOCALES = ["en-US", "ja-JP"] as const;

async function cacheAnilistMapping(
	tmdbTvId: number,
	anilistId: number,
	idMal: number | null | undefined,
): Promise<void> {
	const [row] = await db
		.select({ tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbTvId))
		.limit(1);
	if (!row) return;

	const merged = {
		...(row.tmdbJson ?? {}),
		_stillAnilist: {
			anilistId,
			idMal: idMal ?? null,
			mappedAt: new Date().toISOString(),
		},
	};
	await db.update(tv).set({ tmdbJson: merged }).where(eq(tv.tmdbId, tmdbTvId));
}

async function findCachedTmdbIdForAnilist(
	anilistId: number,
): Promise<number | null> {
	const [row] = await db
		.select({ tmdbId: tv.tmdbId })
		.from(tv)
		.where(
			sql`((${tv.tmdbJson}->'_stillAnilist'->>'anilistId')::int) = ${anilistId}`,
		)
		.limit(1);
	return row?.tmdbId ?? null;
}

function yearFromMedia(media: AnilistImportMedia): number | null {
	const y = media.startDate?.year;
	return y != null && Number.isFinite(y) ? Math.floor(y) : null;
}

/** Prefer animation + Japanese + year when multiple TV search hits exist. */
export function pickBestAnimeTvSearchHit(
	candidates: TmdbTvSummary[],
	year: number | null,
): number | null {
	if (candidates.length === 0) return null;

	let bestId: number | null = null;
	let bestScore = Number.NEGATIVE_INFINITY;

	for (const candidate of candidates) {
		let score = candidate.popularity ?? 0;
		if (year != null && candidate.first_air_date?.startsWith(String(year))) {
			score += 100;
		}
		if (candidate.genre_ids?.includes(TMDB_ANIMATION_GENRE_ID)) {
			score += 50;
		}
		if (candidate.original_language === "ja") {
			score += 25;
		}
		if (score > bestScore) {
			bestScore = score;
			bestId = candidate.id;
		}
	}

	return bestId;
}

async function searchTmdbTvQuery(
	query: string,
	year: number | null,
): Promise<number | null> {
	for (const locale of TMDB_IMPORT_SEARCH_LOCALES) {
		const search = await tmdbApi.searchTv(query, 1, { language: locale });
		const tmdbId = pickBestAnimeTvSearchHit(search.results ?? [], year);
		if (tmdbId != null) return tmdbId;
	}
	return null;
}

async function searchTmdbTvForMedia(
	media: AnilistImportMedia,
	extraQueries: string[] = [],
): Promise<number | null> {
	const year = yearFromMedia(media);
	const queries = [
		...anilistMediaSearchQueries(media),
		...extraQueries.filter((q) => q.trim().length > 0),
	];
	const seen = new Set<string>();

	for (const query of queries) {
		const trimmed = query.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);

		const tmdbId = await searchTmdbTvQuery(trimmed, year);
		if (tmdbId != null) return tmdbId;
	}
	return null;
}

async function resolveWithTitleEnrichment(
	media: AnilistImportMedia,
): Promise<number | null> {
	let tmdbId = await searchTmdbTvForMedia(media);
	if (tmdbId != null) return tmdbId;

	// Backup JSON often only has romaji userPreferred — fetch english/native from Anilist.
	const remoteTitles = await fetchAnilistMediaTitles(media.anilistId);
	if (remoteTitles) {
		const merged = {
			...media,
			title: mergeAnilistMediaTitles(media.title, remoteTitles),
		};
		tmdbId = await searchTmdbTvForMedia(merged);
		if (tmdbId != null) return tmdbId;
	}

	if (media.idMal != null && media.idMal > 0) {
		const malTitles = await fetchMalAnimeSearchTitles(media.idMal);
		tmdbId = await searchTmdbTvForMedia(media, malTitles);
		if (tmdbId != null) return tmdbId;
	}

	return null;
}

/**
 * Resolve an Anilist media row to a TMDb TV id (cache → multi-locale title search → Anilist/MAL enrich).
 */
export async function resolveAnilistMediaToTmdbTvId(
	media: AnilistImportMedia,
): Promise<number | null> {
	const cached = await findCachedTmdbIdForAnilist(media.anilistId);
	if (cached != null) return cached;

	if (
		anilistMediaSearchQueries(media).length === 0 &&
		(media.idMal == null || media.idMal <= 0)
	) {
		// No local titles — still try Anilist id lookup below.
	}

	try {
		const tmdbId = await resolveWithTitleEnrichment(media);
		if (tmdbId != null) {
			await cacheAnilistMapping(tmdbId, media.anilistId, media.idMal).catch(
				() => {},
			);
		}
		return tmdbId;
	} catch (err) {
		console.error("[resolve-anilist-tv-tmdb] TMDb search failed", err);
		return null;
	}
}
