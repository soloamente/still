import type {
	SavedQuoteLobbyItem,
	SavedQuotesPage,
} from "@/lib/quote-saved-types";
import {
	LISTING_QUOTE_SOURCES,
	type ListingQuoteSource,
} from "@/lib/quote-types";
import { QUOTES_LOBBY_PAGE_SIZE } from "@/lib/quotes-lobby";

function normalizeListingQuoteSource(value: unknown): ListingQuoteSource {
	if (
		typeof value === "string" &&
		(LISTING_QUOTE_SOURCES as readonly string[]).includes(value)
	) {
		return value as ListingQuoteSource;
	}
	return "external_api";
}

function normalizeSavedAt(value: unknown): string {
	if (typeof value === "string") return value;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	return new Date().toISOString();
}

function normalizeSavedQuoteItem(raw: unknown): SavedQuoteLobbyItem | null {
	if (!raw || typeof raw !== "object") return null;
	const row = raw as Record<string, unknown>;
	const saveId = row.saveId;
	const quote = row.quote;
	const listing = row.listing;
	const visibility = row.visibility;
	if (typeof saveId !== "string" || !quote || typeof quote !== "object") {
		return null;
	}
	if (!listing || typeof listing !== "object") return null;
	const q = quote as Record<string, unknown>;
	const l = listing as Record<string, unknown>;
	const kind = l.kind;
	if (kind !== "movie" && kind !== "tv") return null;
	const id = l.id;
	if (typeof id !== "number" || !Number.isFinite(id)) return null;

	return {
		saveId,
		savedAt: normalizeSavedAt(row.savedAt),
		visibility:
			visibility === "public" ||
			visibility === "private" ||
			visibility === "followers" ||
			visibility === "friends"
				? visibility
				: "private",
		quote: {
			id: String(q.id ?? ""),
			body: String(q.body ?? ""),
			speaker: typeof q.speaker === "string" ? q.speaker : null,
			timestampMs: typeof q.timestampMs === "number" ? q.timestampMs : null,
			timestampLabel:
				typeof q.timestampLabel === "string" ? q.timestampLabel : null,
			source: normalizeListingQuoteSource(q.source),
			upvoteCount: typeof q.upvoteCount === "number" ? q.upvoteCount : 0,
			seasonNumber: typeof q.seasonNumber === "number" ? q.seasonNumber : null,
			episodeNumber:
				typeof q.episodeNumber === "number" ? q.episodeNumber : null,
		},
		listing: {
			kind,
			id,
			title: typeof l.title === "string" ? l.title : "Unknown title",
			posterPath: typeof l.posterPath === "string" ? l.posterPath : null,
			posterUrl: typeof l.posterUrl === "string" ? l.posterUrl : null,
			year: typeof l.year === "number" ? l.year : null,
			seasonNumber: typeof l.seasonNumber === "number" ? l.seasonNumber : null,
			episodeNumber:
				typeof l.episodeNumber === "number" ? l.episodeNumber : null,
		},
	};
}

/** Shared normalizer for me + profile saved-quote list payloads. */
export function normalizeSavedQuotesPage(raw: unknown): SavedQuotesPage {
	const empty: SavedQuotesPage = {
		items: [],
		page: 1,
		limit: QUOTES_LOBBY_PAGE_SIZE,
		hasMore: false,
	};
	if (!raw || typeof raw !== "object") return empty;
	const data = raw as Record<string, unknown>;
	const items = Array.isArray(data.items)
		? data.items
				.map(normalizeSavedQuoteItem)
				.filter((item): item is SavedQuoteLobbyItem => item != null)
		: [];
	return {
		items,
		page: typeof data.page === "number" ? data.page : 1,
		limit: typeof data.limit === "number" ? data.limit : QUOTES_LOBBY_PAGE_SIZE,
		hasMore: data.hasMore === true,
	};
}
