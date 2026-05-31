import { db, tv } from "@still/db";
import { eq } from "drizzle-orm";
import { ensureTvCached } from "./tv-cache";
import {
	readMalIdFromTmdbDetail,
	readMalIdFromTmdbJson,
	STILL_MAL_JSON_KEY,
	type StillMalJson,
} from "./tv-mal-id";

const JIKAN_ANIME_BASE = "https://api.jikan.moe/v4/anime";
/** Jikan is public — cache enrichment on the TV row for a week to respect rate limits. */
export const MAL_ENRICHMENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TvMalEnrichment = {
	malId: number;
	score: number | null;
	rank: number | null;
	popularity: number | null;
	status: string | null;
};

export function readStillMalCache(
	tmdbJson: Record<string, unknown> | null | undefined,
): TvMalEnrichment | null {
	if (!tmdbJson) return null;
	const block = tmdbJson[STILL_MAL_JSON_KEY] as StillMalJson | undefined;
	if (!block?.malId || block.malId <= 0) return null;
	if (block.score == null && block.rank == null && !block.status?.trim()) {
		return null;
	}
	return {
		malId: Math.floor(block.malId),
		score: block.score ?? null,
		rank: block.rank ?? null,
		popularity: block.popularity ?? null,
		status: block.status?.trim() ?? null,
	};
}

export function isStillMalCacheFresh(
	block: StillMalJson | undefined,
	nowMs = Date.now(),
): boolean {
	if (!block?.fetchedAt) return false;
	const fetched = Date.parse(block.fetchedAt);
	if (!Number.isFinite(fetched)) return false;
	return nowMs - fetched < MAL_ENRICHMENT_CACHE_TTL_MS;
}

/** Format Jikan `/anime/{id}` payload into the small DTO we expose on TV detail. */
export function mapJikanAnimeToEnrichment(
	malId: number,
	data: {
		score?: number | null;
		rank?: number | null;
		popularity?: number | null;
		status?: string | null;
	},
): TvMalEnrichment {
	return {
		malId,
		score:
			data.score != null && Number.isFinite(Number(data.score))
				? Number(data.score)
				: null,
		rank:
			data.rank != null && Number.isFinite(Number(data.rank))
				? Math.floor(Number(data.rank))
				: null,
		popularity:
			data.popularity != null && Number.isFinite(Number(data.popularity))
				? Math.floor(Number(data.popularity))
				: null,
		status: data.status?.trim() ?? null,
	};
}

async function fetchJikanMalEnrichment(
	malId: number,
): Promise<TvMalEnrichment | null> {
	try {
		const res = await fetch(`${JIKAN_ANIME_BASE}/${malId}`, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			data?: {
				score?: number | null;
				rank?: number | null;
				popularity?: number | null;
				status?: string | null;
			};
		};
		if (!json.data) return null;
		return mapJikanAnimeToEnrichment(malId, json.data);
	} catch (err) {
		console.warn("[mal-anime-enrichment] Jikan fetch failed", malId, err);
		return null;
	}
}

async function persistStillMalBlock(
	tmdbTvId: number,
	block: StillMalJson,
): Promise<void> {
	const [row] = await db
		.select({ tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbTvId))
		.limit(1);
	if (!row) return;

	const merged = {
		...(row.tmdbJson ?? {}),
		[STILL_MAL_JSON_KEY]: block,
	};
	await db.update(tv).set({ tmdbJson: merged }).where(eq(tv.tmdbId, tmdbTvId));
}

/** Link a discovered MAL id onto the cached TV row without wiping an existing enrichment cache. */
export async function syncTvMalIdFromDetail(
	tmdbTvId: number,
	detail: Record<string, unknown>,
): Promise<void> {
	const malId = readMalIdFromTmdbDetail(detail);
	if (malId == null) return;

	const [row] = await db
		.select({ tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbTvId))
		.limit(1);
	if (!row) return;

	const existingMal = readMalIdFromTmdbJson(row.tmdbJson);
	const stillMal = (row.tmdbJson?.[STILL_MAL_JSON_KEY] ?? {}) as StillMalJson;
	if (existingMal === malId && stillMal.malId === malId) return;

	const detailExternalIds = detail.external_ids as
		| { mal_id?: number | null }
		| undefined;
	const rowExternalIds = row.tmdbJson?.external_ids as
		| { mal_id?: number | null }
		| undefined;

	const merged = {
		...(row.tmdbJson ?? {}),
		external_ids: {
			...(rowExternalIds ?? {}),
			...(detailExternalIds ?? {}),
			mal_id: malId,
		},
		[STILL_MAL_JSON_KEY]: {
			...stillMal,
			malId,
		},
	};
	await db.update(tv).set({ tmdbJson: merged }).where(eq(tv.tmdbId, tmdbTvId));
}

/**
 * Read-through MAL enrichment for `/tv/[id]` — uses `_stillMal` on the TV row with a 7d TTL.
 * Fails closed (null) when no MAL id or Jikan is unavailable.
 */
export async function getTvMalEnrichment(
	tmdbTvId: number,
): Promise<TvMalEnrichment | null> {
	await ensureTvCached(tmdbTvId);

	const [row] = await db
		.select({ tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbTvId))
		.limit(1);
	if (!row) return null;

	const malId = readMalIdFromTmdbJson(row.tmdbJson);
	if (malId == null) return null;

	const stillMal = (row.tmdbJson?.[STILL_MAL_JSON_KEY] ?? {}) as StillMalJson;
	const cached = readStillMalCache(row.tmdbJson);
	if (cached && isStillMalCacheFresh(stillMal)) {
		return cached;
	}

	const fresh = await fetchJikanMalEnrichment(malId);
	if (!fresh) return null;

	await persistStillMalBlock(tmdbTvId, {
		malId,
		fetchedAt: new Date().toISOString(),
		score: fresh.score,
		rank: fresh.rank,
		popularity: fresh.popularity,
		status: fresh.status,
	});
	return fresh;
}
