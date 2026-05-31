/** Mirrors `apps/server/src/lib/feed-rating-divergence.ts` for Activity tab rows. */

export type FeedDivergencePatron = {
	userId: string;
	user: { id: string; name: string; image: string | null };
	profile: { handle: string; displayName: string } | null;
	rating: number;
	displayRating: number;
	watchedAtMs: number;
};

export type FeedRatingDivergencePayload = {
	mediaKind: "movie" | "tv";
	movieId: number | null;
	tvId: number | null;
	title: string;
	posterPath: string | null;
	lowPatron: FeedDivergencePatron;
	highPatron: FeedDivergencePatron;
	delta: number;
};

export function isFeedRatingDivergencePayload(
	value: unknown,
): value is FeedRatingDivergencePayload {
	if (!value || typeof value !== "object") return false;
	const row = value as FeedRatingDivergencePayload;
	return (
		(row.mediaKind === "movie" || row.mediaKind === "tv") &&
		typeof row.title === "string" &&
		row.lowPatron != null &&
		row.highPatron != null &&
		typeof row.delta === "number"
	);
}
