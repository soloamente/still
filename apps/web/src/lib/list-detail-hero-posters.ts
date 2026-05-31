import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import { resolveListCoverImageSrc } from "@/lib/list-cover-image";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";

/** Hero poster + optional backdrop still for list detail (app + public SEO pages). */
export function listHeroPosterUrls(
	listId: string,
	rows: ListDetailFilmRow[],
	coverMovieId: number | null,
	coverTvId: number | null,
	coverImageUrl: string | null,
	updatedAt: string,
): {
	posterUrl: string | null;
	backdropUrl: string | null;
} {
	const customCover = resolveListCoverImageSrc(
		listId,
		coverImageUrl,
		updatedAt,
	);
	if (customCover) {
		const urls: string[] = [customCover];
		for (const row of rows) {
			const posterPath = row.movie?.posterPath ?? row.tv?.posterPath ?? null;
			const src = profilePosterUrlFromPath(posterPath);
			if (src && !urls.includes(src)) urls.push(src);
			if (urls.length >= 2) break;
		}
		return {
			posterUrl: customCover,
			backdropUrl: urls[1] ?? null,
		};
	}

	const ordered =
		coverMovieId != null
			? [
					...rows.filter((r) => r.movie?.tmdbId === coverMovieId),
					...rows.filter((r) => r.movie?.tmdbId !== coverMovieId),
				]
			: coverTvId != null
				? [
						...rows.filter((r) => r.tv?.tmdbId === coverTvId),
						...rows.filter((r) => r.tv?.tmdbId !== coverTvId),
					]
				: rows;

	const urls: string[] = [];
	for (const row of ordered) {
		const posterPath = row.movie?.posterPath ?? row.tv?.posterPath ?? null;
		const src = profilePosterUrlFromPath(posterPath);
		if (src && !urls.includes(src)) urls.push(src);
		if (urls.length >= 2) break;
	}
	return {
		posterUrl: urls[0] ?? null,
		backdropUrl: urls[1] ?? null,
	};
}
