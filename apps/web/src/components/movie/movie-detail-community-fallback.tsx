import { MovieDetailAboutBodyFallback } from "@/components/movie/movie-detail-view-loading";

/** Shown while `MovieDetailCommunityPanel` streams community data. */
export function MovieDetailCommunityFallback() {
	return (
		<MovieDetailAboutBodyFallback
			ariaLabel="Loading community"
			variant="community"
		/>
	);
}
