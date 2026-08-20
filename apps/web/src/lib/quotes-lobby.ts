import { buildMovieDetailViewHref } from "@/lib/movie-detail-view";
import type { SavedQuoteListingThumb } from "@/lib/quote-saved-types";

/** `/quotes` primary collection — saved bookmarks vs patron submissions. */
export type QuotesLobbyView = "saved" | "submitted";

/** Patron submission moderation filter on `/quotes?view=submitted`. */
export type QuotesSubmissionStatusFilter =
	| "all"
	| "pending"
	| "approved"
	| "rejected";

/** `/quotes` media filter — All · Films · Shows. */
export type QuotesLobbyKind = "all" | "movie" | "tv";

const DEFAULT_KIND: QuotesLobbyKind = "all";
const DEFAULT_VIEW: QuotesLobbyView = "saved";
const DEFAULT_SUBMISSION_STATUS: QuotesSubmissionStatusFilter = "all";

export const QUOTES_LOBBY_PAGE_SIZE = 20;

export function parseQuotesLobbyView(
	raw: string | null | undefined,
): QuotesLobbyView {
	if (raw === "submitted") return "submitted";
	return DEFAULT_VIEW;
}

export function parseQuotesSubmissionStatusFilter(
	raw: string | null | undefined,
): QuotesSubmissionStatusFilter {
	if (raw === "pending" || raw === "approved" || raw === "rejected") {
		return raw;
	}
	return DEFAULT_SUBMISSION_STATUS;
}

export function parseQuotesLobbyKind(
	raw: string | null | undefined,
): QuotesLobbyKind {
	if (raw === "movie" || raw === "tv") return raw;
	return DEFAULT_KIND;
}

export function buildQuotesLobbyHref(opts: {
	kind?: QuotesLobbyKind;
	view?: QuotesLobbyView;
	status?: QuotesSubmissionStatusFilter;
}): string {
	const kind = opts.kind ?? DEFAULT_KIND;
	const view = opts.view ?? DEFAULT_VIEW;
	const status = opts.status ?? DEFAULT_SUBMISSION_STATUS;
	const params = new URLSearchParams();

	if (view !== DEFAULT_VIEW) params.set("view", view);
	if (kind !== DEFAULT_KIND) params.set("kind", kind);
	if (view === "submitted" && status !== DEFAULT_SUBMISSION_STATUS) {
		params.set("status", status);
	}

	const qs = params.toString();
	return qs ? `/quotes?${qs}` : "/quotes";
}

export function quotesLobbySearchState(raw: {
	kind?: string | null;
	view?: string | null;
	status?: string | null;
}): {
	kind: QuotesLobbyKind;
	view: QuotesLobbyView;
	status: QuotesSubmissionStatusFilter;
} {
	return {
		kind: parseQuotesLobbyKind(raw.kind),
		view: parseQuotesLobbyView(raw.view),
		status: parseQuotesSubmissionStatusFilter(raw.status),
	};
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
