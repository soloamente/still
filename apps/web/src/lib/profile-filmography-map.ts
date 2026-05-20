import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import type { PersonFilmographyRow } from "@/lib/person-filmography";

/** TMDb still path → absolute URL for profile tiles and catalogue grids. */
export function profilePosterUrlFromPath(path: string | null): string | null {
	if (!path?.length) return null;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
}

function patronScoreLabel(row: ProfileFilmographyRow): string | null {
	const r = row.log.rating;
	if (r != null && r > 0) return `${String(r)} / 10`;
	if (row.log.liked) return "Liked";
	return null;
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
	const roles: string[] = [];
	const score = patronScoreLabel(row);
	if (score) roles.push(score);

	return {
		tmdbId: listing.tmdbId,
		mediaKind,
		title: listing.title,
		posterUrl: profilePosterUrlFromPath(listing.posterPath),
		releaseDate: patronWatchedAtIso(row.log.watchedAt),
		roles,
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
