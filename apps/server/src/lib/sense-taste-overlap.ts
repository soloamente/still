/**
 * Sense Tier 1 — taste overlap / rivalry comparison (pure logic, no I/O).
 * Framing stays positive: "interestingly different" beats "incompatible."
 */

export type OverlapMediaKind = "movie" | "tv";

/** One deduped diary row per film or show (latest `watchedAt` wins). */
export interface OverlapDiarySlice {
	key: string;
	mediaKind: OverlapMediaKind;
	movieId: number | null;
	tvId: number | null;
	title: string;
	posterPath: string | null;
	/** Stored `log.rating` (tenths or legacy 1–10). */
	rating: number | null;
	watchedAtMs: number;
}

export interface TasteOverlapDivergence {
	key: string;
	mediaKind: OverlapMediaKind;
	movieId: number | null;
	tvId: number | null;
	title: string;
	posterPath: string | null;
	viewerRating: number;
	targetRating: number;
	delta: number;
}

export interface TasteOverlapPayload {
	compatibilityPercent: number;
	framingHeadline: string;
	framingSubline: string;
	sharedWatches: number;
	viewerOnlyWatches: number;
	targetOnlyWatches: number;
	ratedOverlap: number;
	averageRatingDelta: number | null;
	divergences: TasteOverlapDivergence[];
}

export function logMediaKey(
	movieId: number | null,
	tvId: number | null,
): string | null {
	if (movieId != null) return `m:${movieId}`;
	if (tvId != null) return `t:${tvId}`;
	return null;
}

/** Normalise stored rating to 0–10 display scale (matches web `logRatingToDisplay`). */
export function storedRatingToDisplayTen(stored: number): number {
	return stored / 10;
}

/** Keep the newest log per title when building overlap maps. */
export function buildOverlapDiaryMap(
	slices: OverlapDiarySlice[],
): Map<string, OverlapDiarySlice> {
	const map = new Map<string, OverlapDiarySlice>();
	for (const slice of slices) {
		const existing = map.get(slice.key);
		if (!existing || slice.watchedAtMs > existing.watchedAtMs) {
			map.set(slice.key, slice);
		}
	}
	return map;
}

/**
 * Compares two patrons' deduped diaries. Symmetric — swapping maps yields the same score.
 */
export function computeTasteOverlap(
	viewerMap: Map<string, OverlapDiarySlice>,
	targetMap: Map<string, OverlapDiarySlice>,
): TasteOverlapPayload {
	let sharedWatches = 0;
	let viewerOnlyWatches = 0;
	let targetOnlyWatches = 0;
	const divergences: TasteOverlapDivergence[] = [];
	let ratingDeltaSum = 0;
	let ratedOverlap = 0;

	for (const [key, viewerEntry] of viewerMap) {
		const targetEntry = targetMap.get(key);
		if (targetEntry) {
			sharedWatches += 1;
			if (viewerEntry.rating != null && targetEntry.rating != null) {
				const viewerRating = storedRatingToDisplayTen(viewerEntry.rating);
				const targetRating = storedRatingToDisplayTen(targetEntry.rating);
				const delta = Math.abs(viewerRating - targetRating);
				ratingDeltaSum += delta;
				ratedOverlap += 1;
				divergences.push({
					key,
					mediaKind: viewerEntry.mediaKind,
					movieId: viewerEntry.movieId,
					tvId: viewerEntry.tvId,
					title: viewerEntry.title,
					posterPath: viewerEntry.posterPath ?? targetEntry.posterPath,
					viewerRating,
					targetRating,
					delta,
				});
			}
		} else {
			viewerOnlyWatches += 1;
		}
	}

	for (const key of targetMap.keys()) {
		if (!viewerMap.has(key)) targetOnlyWatches += 1;
	}

	divergences.sort((a, b) => b.delta - a.delta);

	const compatibilityPercent = computeCompatibilityPercent({
		sharedWatches,
		ratedOverlap,
		ratingDeltaSum,
	});
	const framing = buildOverlapFraming({
		compatibilityPercent,
		sharedWatches,
		ratedOverlap,
	});

	return {
		compatibilityPercent,
		framingHeadline: framing.headline,
		framingSubline: framing.subline,
		sharedWatches,
		viewerOnlyWatches,
		targetOnlyWatches,
		ratedOverlap,
		averageRatingDelta:
			ratedOverlap > 0
				? Math.round((ratingDeltaSum / ratedOverlap) * 10) / 10
				: null,
		divergences: divergences.slice(0, 6),
	};
}

function computeCompatibilityPercent(args: {
	sharedWatches: number;
	ratedOverlap: number;
	ratingDeltaSum: number;
}): number {
	if (args.sharedWatches === 0) return 0;
	if (args.ratedOverlap === 0) {
		return Math.min(55, 12 + args.sharedWatches * 3);
	}
	const meanDelta = args.ratingDeltaSum / args.ratedOverlap;
	const similarity = 1 - Math.min(meanDelta / 10, 1);
	const ratingScore = similarity * 100;
	const breadthBoost = Math.min(15, args.sharedWatches * 0.5);
	return Math.round(
		Math.min(100, Math.max(0, ratingScore * 0.85 + breadthBoost)),
	);
}

function buildOverlapFraming(args: {
	compatibilityPercent: number;
	sharedWatches: number;
	ratedOverlap: number;
}): { headline: string; subline: string } {
	const { compatibilityPercent, sharedWatches, ratedOverlap } = args;

	let headline: string;
	if (sharedWatches === 0) {
		headline = "No shared diary titles yet — log a few overlaps to compare.";
	} else if (compatibilityPercent >= 80) {
		headline = "Remarkably aligned — you often score the same films similarly.";
	} else if (compatibilityPercent >= 60) {
		headline =
			"Strong overlap — plenty of shared watches with room to debate the scores.";
	} else if (compatibilityPercent >= 40) {
		headline = "Wonderfully different takes on the same cinema.";
	} else {
		headline = "Same screenings, different lenses — interestingly far apart.";
	}

	const sharedLabel = sharedWatches === 1 ? "title" : "titles";
	let subline: string;
	if (sharedWatches === 0) {
		subline =
			"Follow each other's diaries and check back when you've logged the same films or shows.";
	} else if (ratedOverlap === 0) {
		subline = `${sharedWatches} shared ${sharedLabel} — add ratings on both sides to sharpen the match score.`;
	} else {
		subline = `${sharedWatches} shared ${sharedLabel}, ${ratedOverlap} rated by both of you.`;
	}

	return { headline, subline };
}
