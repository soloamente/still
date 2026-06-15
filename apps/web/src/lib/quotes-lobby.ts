import { buildMovieDetailViewHref } from "@/lib/movie-detail-view";
import type { SavedQuoteListingThumb } from "@/lib/quote-saved-types";

/** `/quotes` media filter — All · Films · Shows. */
export type QuotesLobbyKind = "all" | "movie" | "tv";

const DEFAULT_KIND: QuotesLobbyKind = "all";

export const QUOTES_LOBBY_PAGE_SIZE = 20;

export function parseQuotesLobbyKind(
	raw: string | null | undefined,
): QuotesLobbyKind {
	if (raw === "movie" || raw === "tv") return raw;
	return DEFAULT_KIND;
}

export function buildQuotesLobbyHref(opts: { kind?: QuotesLobbyKind }): string {
	const kind = opts.kind ?? DEFAULT_KIND;
	if (kind === DEFAULT_KIND) return "/quotes";
	const params = new URLSearchParams();
	params.set("kind", kind);
	return `/quotes?${params.toString()}`;
}

/** Deep link to the title Quotes tab from a saved row or notification payload. */
export function savedQuoteListingHref(listing: SavedQuoteListingThumb): string {
	const basePath =
		listing.kind === "movie" ? `/movies/${listing.id}` : `/tv/${listing.id}`;
	return buildMovieDetailViewHref(basePath, "quotes", {
		listingKind: listing.kind,
		season: listing.seasonNumber,
		episode: listing.episodeNumber,
	});
}

/** Build quote approval notification href when the server omitted `payload.href`. */
export function buildQuoteSubmissionNotificationHref(payload: {
	movieId?: unknown;
	tvId?: unknown;
	seasonNumber?: unknown;
	episodeNumber?: unknown;
}): string | undefined {
	const movieId = payload.movieId;
	if (typeof movieId === "number" && Number.isFinite(movieId)) {
		return buildMovieDetailViewHref(`/movies/${movieId}`, "quotes");
	}
	const tvId = payload.tvId;
	const seasonNumber = payload.seasonNumber;
	const episodeNumber = payload.episodeNumber;
	if (
		typeof tvId === "number" &&
		Number.isFinite(tvId) &&
		typeof seasonNumber === "number" &&
		Number.isFinite(seasonNumber) &&
		typeof episodeNumber === "number" &&
		Number.isFinite(episodeNumber)
	) {
		return buildMovieDetailViewHref(`/tv/${tvId}`, "quotes", {
			listingKind: "tv",
			season: seasonNumber,
			episode: episodeNumber,
		});
	}
	return undefined;
}
