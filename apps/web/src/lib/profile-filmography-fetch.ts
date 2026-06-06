import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import { profileWatchedRowToPersonFilmography } from "@/lib/profile-filmography-map";
import { stillApiOrigin } from "@/lib/still-api-origin";

export type ProfileFilmographyVenueCounts = { movies: number; tv: number };

export type FilmographyQueryOpts = {
	media: "movie" | "tv";
	order: "latest" | "earliest" | "title";
	/** Omit / null = all venues. */
	venue?: "theaters" | "streaming" | null;
	favorites?: boolean;
	signal?: AbortSignal;
};

/** Endpoint row → poster seed (carries the rating/like caption as scopeLabel). */
export function profileFilmographyRowToSeed(
	row: ProfileFilmographyRow,
): PopularMovieSeed | null {
	const person = profileWatchedRowToPersonFilmography(row);
	if (!person) return null;
	return {
		id: person.tmdbId,
		title: person.title,
		poster_url: person.posterUrl,
		listingKind: person.mediaKind === "tv" ? "tv" : "movie",
		scopeLabel: person.posterCaption ?? null,
		patronLogId: row.log.id,
		patronLogLiked: row.log.liked,
	};
}

function buildFilmographyUrl(
	handle: string,
	page: number,
	opts: FilmographyQueryOpts,
): URL {
	const url = new URL(
		`/api/profiles/${encodeURIComponent(handle)}/filmography`,
		stillApiOrigin(),
	);
	url.searchParams.set("media", opts.media);
	url.searchParams.set("order", opts.order);
	if (opts.venue) url.searchParams.set("venue", opts.venue);
	if (opts.favorites) url.searchParams.set("favorites", "1");
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	return url;
}

/** Client load-more for the profile grid (PopularMoviesInfinite `loadPage`). */
export async function fetchProfileFilmography(
	handle: string,
	page: number,
	opts: FilmographyQueryOpts,
): Promise<
	{ results: PopularMovieSeed[]; total_pages: number } | { error: true }
> {
	const url = buildFilmographyUrl(handle, page, opts);
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts.signal,
	});
	if (!response.ok) return { error: true };
	const raw = (await response.json().catch(() => null)) as {
		results?: ProfileFilmographyRow[];
		total_pages?: number;
	} | null;
	if (!raw || !Array.isArray(raw.results)) return { error: true };
	const results = raw.results
		.map(profileFilmographyRowToSeed)
		.filter((s): s is PopularMovieSeed => s != null);
	return {
		results,
		total_pages: typeof raw.total_pages === "number" ? raw.total_pages : page,
	};
}
