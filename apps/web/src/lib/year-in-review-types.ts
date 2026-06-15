/** Wrapped / Year in Review payload — mirrors `apps/server/src/lib/year-in-review.ts`. */
export type YearInReviewTopTitle = {
	kind: "movie" | "tv";
	tmdbId: number;
	title: string;
	posterPath: string | null;
	year: number | null;
	rating: number | null;
	watchedAt: string;
};

export type YearInReviewGenreStat = {
	genreId: number;
	label: string;
	count: number;
};

export type YearInReviewPayload = {
	year: number;
	eligible: boolean;
	totalLogs: number;
	averageRating: number | null;
	topGenres: YearInReviewGenreStat[];
	topDecade: number | null;
	busiestMonth: number | null;
	topTitles: YearInReviewTopTitle[];
	longestStreakInYear: number;
	reviewCount: number;
};
