import type {
	QuoteSubmissionLobbyItem,
	QuoteSubmissionStatus,
	QuoteSubmissionsPage,
} from "@/lib/quote-submission-types";
import { QUOTES_LOBBY_PAGE_SIZE } from "@/lib/quotes-lobby";

function normalizeIsoDate(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	return null;
}

function normalizeSubmissionStatus(value: unknown): QuoteSubmissionStatus {
	if (value === "pending" || value === "approved" || value === "rejected") {
		return value;
	}
	return "pending";
}

function normalizeSubmissionItem(
	raw: unknown,
): QuoteSubmissionLobbyItem | null {
	if (!raw || typeof raw !== "object") return null;
	const row = raw as Record<string, unknown>;
	const listing = row.listing;
	const submissionId = row.submissionId;
	if (
		typeof submissionId !== "string" ||
		!listing ||
		typeof listing !== "object"
	) {
		return null;
	}
	const l = listing as Record<string, unknown>;
	const kind = l.kind;
	if (kind !== "movie" && kind !== "tv") return null;
	const id = l.id;
	if (typeof id !== "number" || !Number.isFinite(id)) return null;

	return {
		submissionId,
		status: normalizeSubmissionStatus(row.status),
		body: String(row.body ?? ""),
		speaker: typeof row.speaker === "string" ? row.speaker : null,
		timestampLabel:
			typeof row.timestampLabel === "string" ? row.timestampLabel : null,
		createdAt: normalizeIsoDate(row.createdAt) ?? new Date().toISOString(),
		reviewedAt: normalizeIsoDate(row.reviewedAt),
		staffNote: typeof row.staffNote === "string" ? row.staffNote : null,
		resolvedQuoteId:
			typeof row.resolvedQuoteId === "string" ? row.resolvedQuoteId : null,
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

/** Shared normalizer for patron submission list payloads. */
export function normalizeQuoteSubmissionsPage(
	raw: unknown,
): QuoteSubmissionsPage {
	const empty: QuoteSubmissionsPage = {
		items: [],
		page: 1,
		limit: QUOTES_LOBBY_PAGE_SIZE,
		hasMore: false,
	};
	if (!raw || typeof raw !== "object") return empty;
	const data = raw as Record<string, unknown>;
	const items = Array.isArray(data.items)
		? data.items
				.map(normalizeSubmissionItem)
				.filter((item): item is QuoteSubmissionLobbyItem => item != null)
		: [];
	return {
		items,
		page: typeof data.page === "number" ? data.page : 1,
		limit: typeof data.limit === "number" ? data.limit : QUOTES_LOBBY_PAGE_SIZE,
		hasMore: data.hasMore === true,
	};
}
