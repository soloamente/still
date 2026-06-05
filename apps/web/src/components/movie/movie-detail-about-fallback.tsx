import { MovieDetailAboutBodyFallback } from "@/components/movie/movie-detail-view-loading";

/** Shown while `MovieDetailAboutAsync` streams reviews/lists/awards. */
export function MovieDetailAboutFallback() {
	return <MovieDetailAboutBodyFallback />;
}
