import { db, movie } from "@still/db";
import { eq } from "drizzle-orm";

import {
	buildScreenshotSlides,
	type HeroArtworkSlide,
	normalizeTmdbImagesBundle,
} from "./hero-artwork-slides";
import { tmdbApi } from "./tmdb";

/** Cap picker rail size — full movie detail About tab has no cap. */
const REVIEW_STILL_PICKER_MAX = 24;

/**
 * TMDb widescreen backdrops for a film — powers review reader still picker.
 */
export async function fetchReviewMovieScreenshots(
	movieId: number,
): Promise<HeroArtworkSlide[]> {
	const [row] = await db
		.select()
		.from(movie)
		.where(eq(movie.tmdbId, movieId))
		.limit(1);
	if (!row) return [];

	const cachedImages = normalizeTmdbImagesBundle(
		(row.tmdbJson as { images?: unknown } | null | undefined)?.images as
			| { posters?: unknown[]; backdrops?: unknown[] }
			| undefined,
	);
	const imagesBundle =
		(await tmdbApi.movieImages(movieId).catch(() => null)) ?? cachedImages;

	return buildScreenshotSlides({
		title: row.title,
		backdropPath: row.backdropPath,
		images: imagesBundle,
		maxSlides: REVIEW_STILL_PICKER_MAX,
	});
}

export function resolveReviewStillSlide(
	slides: HeroArtworkSlide[],
	stillSlideKey: string | null | undefined,
): HeroArtworkSlide | null {
	if (!slides.length) return null;
	if (!stillSlideKey) return null;
	return slides.find((slide) => slide.key === stillSlideKey) ?? null;
}

export async function assertValidReviewStillSlideKey(
	movieId: number,
	stillSlideKey: string,
): Promise<boolean> {
	const slides = await fetchReviewMovieScreenshots(movieId);
	return slides.some((slide) => slide.key === stillSlideKey);
}
