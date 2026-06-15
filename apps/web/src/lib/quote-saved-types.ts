import type { ContentVisibility } from "@/components/review/visibility-select";

import type { ListingQuoteItem } from "@/lib/quote-types";

/** Listing thumb on saved-quote rows — mirrors server `SavedQuoteListingThumb`. */
export type SavedQuoteListingThumb = {
	kind: "movie" | "tv";
	id: number;
	title: string;
	posterPath: string | null;
	posterUrl: string | null;
	year: number | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
};

/** One saved quote in `/quotes` lobby or profile strip preview. */
export type SavedQuoteLobbyItem = {
	saveId: string;
	savedAt: string;
	visibility: ContentVisibility;
	quote: ListingQuoteItem;
	listing: SavedQuoteListingThumb;
};

export type SavedQuotesPage = {
	items: SavedQuoteLobbyItem[];
	page: number;
	limit: number;
	hasMore: boolean;
};
