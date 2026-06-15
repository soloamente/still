export const LISTING_QUOTE_SOURCES = [
	"external_api",
	"staff",
	"patron",
] as const;

export type ListingQuoteSource = (typeof LISTING_QUOTE_SOURCES)[number];

/** Published quote row from `GET /api/movies|tv/:id/quotes`. */
export type ListingQuoteItem = {
	id: string;
	body: string;
	speaker: string | null;
	timestampMs: number | null;
	timestampLabel: string | null;
	source: ListingQuoteSource;
	upvoteCount: number;
	seasonNumber: number | null;
	episodeNumber: number | null;
	viewerHasUpvoted?: boolean;
	viewerHasSaved?: boolean;
};

export type ListingQuotesPage = {
	items: ListingQuoteItem[];
	page: number;
	limit: number;
	hasMore: boolean;
};
