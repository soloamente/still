/** Client types for `GET /api/taste/overlap/:handle` (mirrors server payload). */

export interface TasteOverlapDivergence {
	key: string;
	mediaKind: "movie" | "tv";
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

export interface TasteOverlapResponse {
	viewer: { handle: string; displayName: string };
	target: { handle: string; displayName: string };
	overlap: TasteOverlapPayload;
}

/** Maps `GET /api/taste/compare/:a/:b` (`a` / `b`) into the overlap dialog shape. */
export function parseTasteCompareResponse(
	data: unknown,
): TasteOverlapResponse | null {
	if (!data || typeof data !== "object") return null;
	const root = data as Record<string, unknown>;
	return parseTasteOverlapResponse({
		viewer: root.a,
		target: root.b,
		overlap: root.overlap,
	});
}

export function parseTasteOverlapResponse(
	data: unknown,
): TasteOverlapResponse | null {
	if (!data || typeof data !== "object") return null;
	const root = data as Record<string, unknown>;
	const overlapRaw = root.overlap;
	if (!overlapRaw || typeof overlapRaw !== "object") return null;
	const overlap = overlapRaw as Record<string, unknown>;
	const viewer = root.viewer as Record<string, unknown> | undefined;
	const target = root.target as Record<string, unknown> | undefined;
	if (
		typeof viewer?.handle !== "string" ||
		typeof viewer?.displayName !== "string" ||
		typeof target?.handle !== "string" ||
		typeof target?.displayName !== "string" ||
		typeof overlap.compatibilityPercent !== "number" ||
		typeof overlap.framingHeadline !== "string" ||
		typeof overlap.framingSubline !== "string"
	) {
		return null;
	}
	return {
		viewer: {
			handle: viewer.handle,
			displayName: viewer.displayName,
		},
		target: {
			handle: target.handle,
			displayName: target.displayName,
		},
		overlap: {
			compatibilityPercent: overlap.compatibilityPercent,
			framingHeadline: overlap.framingHeadline,
			framingSubline: overlap.framingSubline,
			sharedWatches: Number(overlap.sharedWatches ?? 0),
			viewerOnlyWatches: Number(overlap.viewerOnlyWatches ?? 0),
			targetOnlyWatches: Number(overlap.targetOnlyWatches ?? 0),
			ratedOverlap: Number(overlap.ratedOverlap ?? 0),
			averageRatingDelta:
				typeof overlap.averageRatingDelta === "number"
					? overlap.averageRatingDelta
					: null,
			divergences: Array.isArray(overlap.divergences)
				? (overlap.divergences as TasteOverlapDivergence[])
				: [],
		},
	};
}
