import { db, log, movie, profile, tv, user } from "@still/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { fetchOverlapDiarySlices } from "./fetch-overlap-diary-slices";
import {
	buildOverlapDiaryMap,
	computeTasteOverlap,
} from "./sense-taste-overlap";
import {
	collectMediaIdsFromMap,
	fetchFollowingUserIds,
	fetchOverlapCandidateUserIds,
} from "./taste-neighbor-discovery";

/** Viewer needs enough diary signal before patron suggestions replace cold-start. */
export const SUGGESTED_PATRON_MIN_VIEWER_LOGS = 5;

export const SUGGESTED_PATRON_RESULT_LIMIT = 12;

const GENRE_WEIGHT_LOG_LIMIT = 200;
const MIN_SHARED_TITLES_FOR_CANDIDATE = 2;

const TMDB_GENRE_NAMES: Record<number, string> = {
	28: "action",
	12: "adventure",
	16: "animation",
	35: "comedy",
	80: "crime",
	99: "documentary",
	18: "drama",
	10751: "family",
	14: "fantasy",
	36: "history",
	27: "horror",
	10402: "music",
	9648: "mystery",
	10749: "romance",
	878: "science fiction",
	10770: "TV movie",
	53: "thriller",
	10752: "war",
	37: "western",
};

export type SuggestedPatronRow = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	compatibilityPercent: number;
	sharedWatches: number;
	sharedGenrePhrase: string | null;
};

export type SuggestedPatronsPayload = {
	coldStart: boolean;
	patrons: SuggestedPatronRow[];
};

function genreLabel(id: number): string {
	return TMDB_GENRE_NAMES[id] ?? "film";
}

/** Weighted genre overlap copy for search rows — "drama and thriller". */
export function buildSharedGenrePhrase(
	viewerWeights: Map<number, number>,
	targetWeights: Map<number, number>,
): string | null {
	const overlaps: { id: number; score: number }[] = [];
	for (const [id, viewerWeight] of viewerWeights) {
		const targetWeight = targetWeights.get(id) ?? 0;
		if (targetWeight <= 0) continue;
		overlaps.push({ id, score: Math.min(viewerWeight, targetWeight) });
	}
	if (overlaps.length === 0) return null;
	overlaps.sort((a, b) => b.score - a.score);
	const top = overlaps.slice(0, 2).map((row) => genreLabel(row.id));
	if (top.length === 1) return top[0] ?? null;
	return `${top[0]} and ${top[1]}`;
}

export function rankSuggestedPatronCandidates(
	rows: SuggestedPatronRow[],
): SuggestedPatronRow[] {
	return [...rows].sort((a, b) => {
		if (b.compatibilityPercent !== a.compatibilityPercent) {
			return b.compatibilityPercent - a.compatibilityPercent;
		}
		return b.sharedWatches - a.sharedWatches;
	});
}

async function fetchPatronGenreWeights(
	userId: string,
): Promise<Map<number, number>> {
	const rows = await db
		.select({ movie, tv })
		.from(log)
		.leftJoin(movie, eq(log.movieId, movie.tmdbId))
		.leftJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(and(eq(log.userId, userId), isNull(log.removedAt)))
		.orderBy(desc(log.watchedAt))
		.limit(GENRE_WEIGHT_LOG_LIMIT);

	const weights = new Map<number, number>();
	for (const row of rows) {
		const genreIds = [
			...((row.movie?.genreIds as number[] | undefined) ?? []),
			...((row.tv?.genreIds as number[] | undefined) ?? []),
		];
		for (const id of genreIds) {
			weights.set(id, (weights.get(id) ?? 0) + 1);
		}
	}
	return weights;
}

/**
 * SN.16 — patrons ranked by taste overlap for ⌘K empty state and discovery.
 * Excludes self, already-followed, and private profiles.
 */
export async function buildSuggestedPatrons(
	viewerId: string,
): Promise<SuggestedPatronsPayload> {
	const viewerSlices = await fetchOverlapDiarySlices(viewerId);
	if (viewerSlices.length < SUGGESTED_PATRON_MIN_VIEWER_LOGS) {
		return { coldStart: true, patrons: [] };
	}

	const viewerMap = buildOverlapDiaryMap(viewerSlices);
	const { movieIds, tvIds } = collectMediaIdsFromMap(viewerMap);
	if (movieIds.length === 0 && tvIds.length === 0) {
		return { coldStart: true, patrons: [] };
	}

	const followingIds = await fetchFollowingUserIds(viewerId);
	const candidates = await fetchOverlapCandidateUserIds({
		viewerId,
		movieIds,
		tvIds,
		excludeUserIds: followingIds,
	});
	if (candidates.length === 0) {
		return { coldStart: false, patrons: [] };
	}

	const [viewerGenreWeights, profileRows] = await Promise.all([
		fetchPatronGenreWeights(viewerId),
		db
			.select({
				userId: user.id,
				handle: profile.handle,
				displayName: profile.displayName,
				image: user.image,
			})
			.from(user)
			.innerJoin(profile, eq(profile.userId, user.id))
			.where(
				inArray(
					user.id,
					candidates.map((c) => c.userId),
				),
			),
	]);

	const profileById = new Map(profileRows.map((row) => [row.userId, row]));

	const candidateIds = candidates.map((c) => c.userId);
	const [targetSlicesList, targetGenreWeightsList] = await Promise.all([
		Promise.all(candidateIds.map((id) => fetchOverlapDiarySlices(id))),
		Promise.all(candidateIds.map((id) => fetchPatronGenreWeights(id))),
	]);

	const scored: SuggestedPatronRow[] = [];
	for (let i = 0; i < candidates.length; i += 1) {
		const candidate = candidates[i];
		if (!candidate) continue;
		const profileRow = profileById.get(candidate.userId);
		if (!profileRow?.handle) continue;

		const targetSlices = targetSlicesList[i] ?? [];
		const targetMap = buildOverlapDiaryMap(targetSlices);
		const overlap = computeTasteOverlap(viewerMap, targetMap);
		if (overlap.sharedWatches < MIN_SHARED_TITLES_FOR_CANDIDATE) continue;

		const targetGenreWeights = targetGenreWeightsList[i] ?? new Map();
		const sharedGenrePhrase = buildSharedGenrePhrase(
			viewerGenreWeights,
			targetGenreWeights,
		);

		scored.push({
			userId: profileRow.userId,
			handle: profileRow.handle,
			displayName: profileRow.displayName,
			image: profileRow.image,
			compatibilityPercent: overlap.compatibilityPercent,
			sharedWatches: overlap.sharedWatches,
			sharedGenrePhrase,
		});
	}

	const patrons = rankSuggestedPatronCandidates(scored).slice(
		0,
		SUGGESTED_PATRON_RESULT_LIMIT,
	);

	return { coldStart: false, patrons };
}
