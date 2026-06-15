import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import { patronLogPosterCaption } from "@/lib/patron-log-poster-caption";
import type { PersonFilmographyRow } from "@/lib/person-filmography";

/** TMDb still path → absolute URL for profile tiles and catalogue grids. */
export function profilePosterUrlFromPath(path: string | null): string | null {
	if (!path?.length) return null;
	// Some legacy rows store a full CDN URL instead of a `/path.jpg` fragment.
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
}

function patronScoreLabel(row: ProfileFilmographyRow): string | null {
	return patronLogPosterCaption({
		rating: row.log.rating,
		liked: row.log.liked,
	});
}

function patronWatchedAtIso(watchedAt: unknown): string | null {
	if (watchedAt == null) return null;
	if (watchedAt instanceof Date && !Number.isNaN(watchedAt.getTime())) {
		return watchedAt.toISOString();
	}
	if (typeof watchedAt === "string" || typeof watchedAt === "number") {
		const d = new Date(watchedAt);
		return Number.isNaN(d.getTime()) ? null : d.toISOString();
	}
	return null;
}

/** Map patron diary rows into the actor-drawer `PersonFilmographyGrid` shape. */
export function profileWatchedRowToPersonFilmography(
	row: ProfileFilmographyRow,
): PersonFilmographyRow | null {
	const listing = row.movie ?? row.tv;
	if (!listing) return null;

	const mediaKind = row.tv != null ? "tv" : "movie";
	const posterCaption = patronScoreLabel(row);
	const roles: string[] = posterCaption ? [posterCaption] : [];

	return {
		tmdbId: listing.tmdbId,
		mediaKind,
		title: listing.title,
		posterUrl: profilePosterUrlFromPath(listing.posterPath),
		releaseDate: patronWatchedAtIso(row.log.watchedAt),
		roles,
		posterCaption,
	};
}

export function profileWatchedRowsToPersonFilmography(
	rows: ProfileFilmographyRow[],
): PersonFilmographyRow[] {
	return rows
		.map(profileWatchedRowToPersonFilmography)
		.filter((row): row is PersonFilmographyRow => row != null);
}

export function favoriteToPersonFilmography(favorite: {
	tmdbId: number;
	title: string;
	posterPath: string | null;
}): PersonFilmographyRow {
	return {
		tmdbId: favorite.tmdbId,
		mediaKind: "movie",
		title: favorite.title,
		posterUrl: profilePosterUrlFromPath(favorite.posterPath),
		releaseDate: null,
		roles: ["Favorite"],
	};
}
