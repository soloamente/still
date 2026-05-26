/** Shared marketing film row from TMDB popular lists. */
export type LandingPoster = {
	id: number;
	title: string;
	posterUrl: string | null;
	backdropUrl: string | null;
};

/** Prefer widescreen backdrops for scene plates; fall back to poster art. */
export function landingSceneImageUrl(poster: LandingPoster): string | null {
	return poster.backdropUrl ?? poster.posterUrl;
}
