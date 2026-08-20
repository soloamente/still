import type { SavedQuoteListingThumb } from "@/lib/quote-saved-types";

export type QuoteSubmissionStatus = "pending" | "approved" | "rejected";

/** One patron submission row on `/quotes?view=submitted`. */
export type QuoteSubmissionLobbyItem = {
	submissionId: string;
	status: QuoteSubmissionStatus;
	body: string;
	speaker: string | null;
	timestampLabel: string | null;
	createdAt: string;
	reviewedAt: string | null;
	staffNote: string | null;
	resolvedQuoteId: string | null;
	listing: SavedQuoteListingThumb;
};

export type QuoteSubmissionsPage = {
	items: QuoteSubmissionLobbyItem[];
	page: number;
	limit: number;
	hasMore: boolean;
};
