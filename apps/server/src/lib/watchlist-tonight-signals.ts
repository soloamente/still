import {
	db,
	list,
	listItem,
	log,
	movie,
	profile,
	titleRecommendation,
	user,
} from "@still/db";
import { and, desc, eq, isNull } from "drizzle-orm";

import { BoundedTtlCache } from "./bounded-ttl-cache";
import {
	buildWeightedTasteProfile,
	type TasteProfileSlice,
} from "./taste-profile";
import { loadRecommendationGatesFromSenders } from "./title-recommendation-query";
import { invalidateWatchlistProviderCatalogue } from "./watchlist-provider-catalogue";
import { invalidateWatchlistRanked } from "./watchlist-ranked-cache";

/** Media-aware key — TMDb film and TV ids share the integer namespace. */
export function listingKey(
	movieId: number | null,
	tvId: number | null,
): string {
	return movieId != null ? `movie:${movieId}` : `tv:${tvId}`;
}

/** 0–1: the strongest of this title's genres relative to the viewer's top genre. */
export function normalizedGenreAffinity(
	genreIds: number[],
	weights: Map<number, number>,
): number {
	let top = 0;
	for (const w of weights.values()) top = Math.max(top, w);
	if (top <= 0) return 0;
	let best = 0;
	for (const id of genreIds) best = Math.max(best, weights.get(id) ?? 0);
	return best / top;
}

export type WatchlistTonightSocial = {
	recommenders: Map<string, { name: string; scrubbed: boolean }[]>;
	ownListTitles: Map<string, string>;
	genreWeights: Map<number, number>;
};

const CACHE_MS = 60_000;
/** Hard cap so the per-patron cache can't grow unbounded; oldest evicted first. */
const CACHE_MAX_ENTRIES = 500;
const cache = new BoundedTtlCache<WatchlistTonightSocial>(
	CACHE_MS,
	CACHE_MAX_ENTRIES,
);

/** Received recs (visible senders only), own-list membership, and diary genre weights. */
export async function loadWatchlistTonightSocial(
	userId: string,
): Promise<WatchlistTonightSocial> {
	const hit = cache.get(userId);
	if (hit) return hit;

	const [recRows, listRows, diaryRows] = await Promise.all([
		db
			.select({
				senderId: titleRecommendation.senderUserId,
				movieId: titleRecommendation.movieId,
				tvId: titleRecommendation.tvId,
				scrubbed: titleRecommendation.sensitiveScrub,
				displayName: profile.displayName,
				userName: user.name,
			})
			.from(titleRecommendation)
			.leftJoin(profile, eq(profile.userId, titleRecommendation.senderUserId))
			.leftJoin(user, eq(user.id, titleRecommendation.senderUserId))
			.where(eq(titleRecommendation.recipientUserId, userId))
			.orderBy(desc(titleRecommendation.createdAt))
			.limit(200),
		db
			.select({
				title: list.title,
				movieId: listItem.movieId,
				tvId: listItem.tvId,
			})
			.from(listItem)
			.innerJoin(list, eq(list.id, listItem.listId))
			.where(and(eq(list.userId, userId), isNull(list.removedAt)))
			.limit(2000),
		db
			.select({ rating: log.rating, genreIds: movie.genreIds })
			.from(log)
			.innerJoin(movie, eq(log.movieId, movie.tmdbId))
			.where(and(eq(log.userId, userId), isNull(log.removedAt)))
			.orderBy(desc(log.watchedAt))
			.limit(400),
	]);

	// Recommendation visibility — the sender must still pass the same gate as
	// sending. One batched gate read for all senders (3 queries, not 3 × N).
	const senderIds = [...new Set(recRows.map((r) => r.senderId))].slice(0, 25);
	const gates = await loadRecommendationGatesFromSenders(senderIds, userId);
	const visible = new Set(
		[...gates].filter(([, gate]) => gate.ok).map(([id]) => id),
	);

	// One entry per sender per title, even when they sent the same title twice.
	const recommenders = new Map<string, { name: string; scrubbed: boolean }[]>();
	const seenSenders = new Set<string>();
	for (const row of recRows) {
		if (!visible.has(row.senderId)) continue;
		const key = listingKey(row.movieId, row.tvId);
		const senderKey = `${key}|${row.senderId}`;
		if (seenSenders.has(senderKey)) continue;
		seenSenders.add(senderKey);
		const bucket = recommenders.get(key) ?? [];
		bucket.push({
			name: row.displayName?.trim() || row.userName?.trim() || "Someone",
			scrubbed: row.scrubbed,
		});
		recommenders.set(key, bucket);
	}

	const ownListTitles = new Map<string, string>();
	for (const row of listRows) {
		const key = listingKey(row.movieId, row.tvId);
		if (!ownListTitles.has(key)) ownListTitles.set(key, row.title);
	}

	const total = diaryRows.length;
	const slices: TasteProfileSlice[] = diaryRows.map((row, index) => ({
		genreIds: row.genreIds ?? [],
		rating: row.rating,
		year: null,
		originalLanguage: null,
		popularity: null,
		index,
		total,
	}));
	const genreWeights = buildWeightedTasteProfile(slices).genreWeights;

	const value = { recommenders, ownListTitles, genreWeights };
	cache.set(userId, value);
	return value;
}

/**
 * Drop a patron's cached signals and ranked tonight/available lists after a
 * watchlist mutation (add, remove, alert toggle).
 */
export function invalidateWatchlistTonightSocial(userId: string): void {
	cache.delete(userId);
	invalidateWatchlistRanked(userId);
	invalidateWatchlistProviderCatalogue(userId);
}
