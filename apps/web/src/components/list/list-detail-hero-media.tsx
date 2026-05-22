"use client";

import { MovieDetailHeroMedia } from "@/components/movie/movie-detail-hero-media";

/**
 * List detail hero posters — reuses film {@link MovieDetailHeroMedia} (poster carousel).
 */
export function ListDetailHeroMedia({
	title,
	posterUrl,
	backdropUrl,
}: {
	title: string;
	posterUrl: string | null;
	backdropUrl: string | null;
}) {
	return (
		<MovieDetailHeroMedia
			title={title}
			posterUrl={posterUrl}
			backdropUrl={backdropUrl}
		/>
	);
}
