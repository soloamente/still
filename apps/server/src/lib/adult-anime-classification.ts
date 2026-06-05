import { db, tv } from "@still/db";
import { eq } from "drizzle-orm";

import {
	STILL_ADULT_JSON_KEY,
	type StillAdultJson,
} from "./adult-content-policy";
import { classifyJikanAnimeAdult } from "./adult-jikan-classify";
import { MAL_ENRICHMENT_CACHE_TTL_MS } from "./mal-anime-enrichment";
import { readMalIdFromTmdbDetail, readMalIdFromTmdbJson } from "./tv-mal-id";

const JIKAN_ANIME_BASE = "https://api.jikan.moe/v4/anime";

function isStillAdultCacheFresh(
	block: StillAdultJson | undefined,
	nowMs = Date.now(),
): boolean {
	if (!block?.fetchedAt) return false;
	const fetched = Date.parse(block.fetchedAt);
	if (!Number.isFinite(fetched)) return false;
	return nowMs - fetched < MAL_ENRICHMENT_CACHE_TTL_MS;
}

async function fetchJikanAdultSignals(malId: number) {
	try {
		const res = await fetch(`${JIKAN_ANIME_BASE}/${malId}`, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			data?: { rating?: string | null; genres?: { name?: string | null }[] };
		};
		if (!json.data) return null;
		return classifyJikanAnimeAdult(json.data);
	} catch (err) {
		console.warn("[adult-anime-classification] Jikan fetch failed", malId, err);
		return null;
	}
}

async function persistStillAdultBlock(
	tmdbTvId: number,
	block: StillAdultJson,
): Promise<void> {
	const [row] = await db
		.select({ tmdbJson: tv.tmdbJson, adult: tv.adult })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbTvId))
		.limit(1);
	if (!row) return;

	const mergedJson = {
		...(row.tmdbJson ?? {}),
		[STILL_ADULT_JSON_KEY]: block,
	};
	const nextAdult = row.adult || block.isAdult;
	await db
		.update(tv)
		.set({ tmdbJson: mergedJson, adult: nextAdult })
		.where(eq(tv.tmdbId, tmdbTvId));
}

/** Read-through adult classification for one TV row; warms `_stillAdult` via Jikan when needed. */
export async function ensureTvAdultClassification(
	tmdbTvId: number,
): Promise<StillAdultJson | null> {
	const [row] = await db
		.select({ adult: tv.adult, tmdbJson: tv.tmdbJson })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbTvId))
		.limit(1);
	if (!row) return null;

	const cached = row.tmdbJson?.[STILL_ADULT_JSON_KEY] as
		| StillAdultJson
		| undefined;
	if (cached && isStillAdultCacheFresh(cached)) return cached;

	if (row.adult) {
		const block: StillAdultJson = {
			isAdult: true,
			sources: ["tmdb"],
			fetchedAt: new Date().toISOString(),
		};
		await persistStillAdultBlock(tmdbTvId, block);
		return block;
	}

	const malId =
		readMalIdFromTmdbJson(row.tmdbJson) ??
		readMalIdFromTmdbDetail(row.tmdbJson ?? {});
	if (malId == null) {
		const block: StillAdultJson = {
			isAdult: false,
			sources: [],
			fetchedAt: new Date().toISOString(),
		};
		await persistStillAdultBlock(tmdbTvId, block);
		return block;
	}

	const signals = await fetchJikanAdultSignals(malId);
	const block: StillAdultJson = {
		isAdult: signals?.isAdult ?? false,
		sources: signals?.sources ?? [],
		fetchedAt: new Date().toISOString(),
	};
	await persistStillAdultBlock(tmdbTvId, block);
	return block;
}

/** Warm adult flags for discover/search pages (sequential — Jikan rate limits). */
export async function warmTvAdultClassificationBatch(
	tmdbIds: number[],
): Promise<void> {
	for (const id of tmdbIds) {
		await ensureTvAdultClassification(id);
	}
}

/** TMDb anime keyword id used by curated Anime search tag. */
export const TMDB_ANIME_KEYWORD_ID = 210024;

export function discoverQueryIncludesAnimeKeyword(
	keywords: number[] | undefined,
): boolean {
	if (!keywords?.length) return false;
	return keywords.includes(TMDB_ANIME_KEYWORD_ID);
}
