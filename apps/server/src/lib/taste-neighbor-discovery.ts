import { db, follow, log, profile } from "@still/db";
import {
	and,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	or,
	sql,
} from "drizzle-orm";

import { fetchOverlapDiarySlices } from "./fetch-overlap-diary-slices";
import {
	buildOverlapDiaryMap,
	computeTasteOverlap,
	type OverlapDiarySlice,
} from "./sense-taste-overlap";

/** SQL pool size when searching overlap strangers by shared diary titles. */
const CANDIDATE_POOL_LIMIT = 32;

/** Minimum shared log rows for suggested-patron overlap SQL pre-filter. */
const MIN_SHARED_TITLES_FOR_CANDIDATE = 2;

export type TasteNeighbor = {
	userId: string;
	compatibilityPercent: number;
	tier: 1 | 2; // 1=followed, 2=overlap stranger
};

/** Tier 1 (followed) before tier 2 at equal compatibility, then compatibility desc. */
export function rankTasteNeighbors(rows: TasteNeighbor[]): TasteNeighbor[] {
	return [...rows].sort((a, b) => {
		if (a.tier !== b.tier) return a.tier - b.tier;
		return b.compatibilityPercent - a.compatibilityPercent;
	});
}

export async function fetchFollowingUserIds(
	viewerId: string,
): Promise<string[]> {
	const rows = await db
		.select({ followingId: follow.followingId })
		.from(follow)
		.where(eq(follow.followerId, viewerId));
	return rows.map((row) => row.followingId);
}

export function collectMediaIdsFromMap(
	viewerMap: Map<string, OverlapDiarySlice>,
): { movieIds: number[]; tvIds: number[] } {
	const movieIds = new Set<number>();
	const tvIds = new Set<number>();
	for (const entry of viewerMap.values()) {
		if (entry.movieId != null) movieIds.add(entry.movieId);
		if (entry.tvId != null) tvIds.add(entry.tvId);
	}
	return { movieIds: [...movieIds], tvIds: [...tvIds] };
}

export async function fetchOverlapCandidateUserIds(input: {
	viewerId: string;
	movieIds: number[];
	tvIds: number[];
	excludeUserIds: string[];
}): Promise<Array<{ userId: string; sharedCount: number }>> {
	const { viewerId, movieIds, tvIds, excludeUserIds } = input;
	if (movieIds.length === 0 && tvIds.length === 0) return [];

	const mediaFilter =
		movieIds.length > 0 && tvIds.length > 0
			? or(inArray(log.movieId, movieIds), inArray(log.tvId, tvIds))
			: movieIds.length > 0
				? inArray(log.movieId, movieIds)
				: inArray(log.tvId, tvIds);

	const exclude = new Set([viewerId, ...excludeUserIds]);

	const rows = await db
		.select({
			userId: log.userId,
			sharedCount: sql<number>`count(*)::int`,
		})
		.from(log)
		.innerJoin(profile, eq(log.userId, profile.userId))
		.where(
			and(
				mediaFilter,
				isNull(log.removedAt),
				eq(profile.isPrivate, false),
				isNotNull(profile.handle),
			),
		)
		.groupBy(log.userId)
		.orderBy(desc(sql`count(*)`))
		.limit(CANDIDATE_POOL_LIMIT);

	return rows
		.filter(
			(row) =>
				!exclude.has(row.userId) &&
				row.sharedCount >= MIN_SHARED_TITLES_FOR_CANDIDATE,
		)
		.map((row) => ({ userId: row.userId, sharedCount: row.sharedCount }));
}

/**
 * Resolves taste neighbors for For You social scoring: followed patrons (tier 1)
 * plus public overlap strangers (tier 2) ranked by compatibility.
 */
export async function resolveTasteNeighbors(args: {
	viewerId: string;
	viewerMap: Map<string, OverlapDiarySlice>;
	minSharedTitles?: number;
	minCompatibility?: number;
	limit?: number;
}): Promise<TasteNeighbor[]> {
	const minSharedTitles = args.minSharedTitles ?? 3;
	const minCompatibility = args.minCompatibility ?? 40;
	const limit = args.limit ?? 20;
	const { viewerId, viewerMap } = args;

	const followingIds = await fetchFollowingUserIds(viewerId);

	const followSlicesList = await Promise.all(
		followingIds.map((id) => fetchOverlapDiarySlices(id)),
	);
	const tier1: TasteNeighbor[] = [];
	for (let i = 0; i < followingIds.length; i += 1) {
		const userId = followingIds[i];
		if (!userId) continue;
		const slices = followSlicesList[i] ?? [];
		const targetMap = buildOverlapDiaryMap(slices);
		const overlap = computeTasteOverlap(viewerMap, targetMap);
		tier1.push({
			userId,
			compatibilityPercent: overlap.compatibilityPercent,
			tier: 1,
		});
	}

	const { movieIds, tvIds } = collectMediaIdsFromMap(viewerMap);
	const candidates = await fetchOverlapCandidateUserIds({
		viewerId,
		movieIds,
		tvIds,
		excludeUserIds: followingIds,
	});

	const candidateSlicesList = await Promise.all(
		candidates.map((candidate) => fetchOverlapDiarySlices(candidate.userId)),
	);
	const tier2: TasteNeighbor[] = [];
	for (let i = 0; i < candidates.length; i += 1) {
		const candidate = candidates[i];
		if (!candidate) continue;
		const slices = candidateSlicesList[i] ?? [];
		const targetMap = buildOverlapDiaryMap(slices);
		const overlap = computeTasteOverlap(viewerMap, targetMap);
		if (overlap.sharedWatches < minSharedTitles) continue;
		if (overlap.compatibilityPercent < minCompatibility) continue;
		tier2.push({
			userId: candidate.userId,
			compatibilityPercent: overlap.compatibilityPercent,
			tier: 2,
		});
	}

	return rankTasteNeighbors([...tier1, ...tier2]).slice(0, limit);
}
