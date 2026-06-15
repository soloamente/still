/** Max dialogue quote length — patron submit and staff edit. */
export const LISTING_QUOTE_MAX_BODY_LENGTH = 500;

/** Max speaker / character label length. */
export const LISTING_QUOTE_MAX_SPEAKER_LENGTH = 120;

export const LISTING_QUOTE_DEFAULT_LIMIT = 20;
export const LISTING_QUOTE_MAX_LIMIT = 50;

export const LISTING_QUOTE_SORTS = ["upvotes", "newest"] as const;
export type ListingQuoteSort = (typeof LISTING_QUOTE_SORTS)[number];

export type ListingQuoteScope = {
	movieId: number | null;
	tvId: number | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
};

export type ListingQuoteScopeInput = {
	movieId?: number | null;
	tvId?: number | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
};

export const LISTING_QUOTE_SOURCES = [
	"external_api",
	"staff",
	"patron",
] as const;
export type ListingQuoteSource = (typeof LISTING_QUOTE_SOURCES)[number];

/** API list/detail payload for a published quote. */
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

type ListingQuoteRow = {
	id: string;
	body: string;
	speaker: string | null;
	timestampMs: number | null;
	source: ListingQuoteSource;
	upvoteCount: number;
	seasonNumber: number | null;
	episodeNumber: number | null;
};

/** Trim and enforce quote body limits for submit + staff edits. */
export function validateQuoteBody(raw: string): string {
	const body = raw.trim();
	if (!body) {
		throw new Error("Quote text is required");
	}
	if (body.length > LISTING_QUOTE_MAX_BODY_LENGTH) {
		throw new Error(
			`Quote text max ${LISTING_QUOTE_MAX_BODY_LENGTH} characters`,
		);
	}
	return body;
}

/**
 * Split upstream dialogue that exceeds patron submit limits into importable chunks.
 * Used for bulk providers that ship multi-sentence lines in one string.
 */
export function splitQuoteBodyForImport(
	body: string,
	maxLength: number = LISTING_QUOTE_MAX_BODY_LENGTH,
): string[] {
	const trimmed = body.trim();
	if (!trimmed) return [];
	if (trimmed.length <= maxLength) return [trimmed];

	const parts: string[] = [];
	let rest = trimmed;
	while (rest.length > maxLength) {
		const window = rest.slice(0, maxLength);
		const periodBreak = window.lastIndexOf(". ");
		const spaceBreak = window.lastIndexOf(" ");
		const splitAt =
			periodBreak > 60
				? periodBreak + 1
				: spaceBreak > 40
					? spaceBreak
					: maxLength;
		const chunk = rest.slice(0, splitAt).trim();
		if (!chunk) break;
		parts.push(chunk);
		rest = rest.slice(splitAt).trim();
	}
	if (rest) parts.push(rest);
	return parts.filter((part) => part.length > 0);
}

/** Optional character name on a quote line. */
export function validateQuoteSpeaker(
	raw: string | null | undefined,
): string | null {
	if (raw == null) return null;
	const speaker = raw.trim();
	if (!speaker) return null;
	if (speaker.length > LISTING_QUOTE_MAX_SPEAKER_LENGTH) {
		throw new Error(
			`Speaker max ${LISTING_QUOTE_MAX_SPEAKER_LENGTH} characters`,
		);
	}
	return speaker;
}

/** Ensure exactly one listing target — TV rows require season + episode. */
export function validateListingQuoteScope(
	input: ListingQuoteScopeInput,
): ListingQuoteScope {
	const movieId =
		typeof input.movieId === "number" && Number.isFinite(input.movieId)
			? Math.trunc(input.movieId)
			: null;
	const tvId =
		typeof input.tvId === "number" && Number.isFinite(input.tvId)
			? Math.trunc(input.tvId)
			: null;

	if ((movieId != null && tvId != null) || (movieId == null && tvId == null)) {
		throw new Error("Quote must target exactly one film or TV show");
	}

	if (movieId != null) {
		if (movieId < 1) throw new Error("Invalid movie id");
		if (input.seasonNumber != null || input.episodeNumber != null) {
			throw new Error("Season and episode apply to TV quotes only");
		}
		return {
			movieId,
			tvId: null,
			seasonNumber: null,
			episodeNumber: null,
		};
	}

	const seasonNumber = parsePositiveInt(input.seasonNumber, "season");
	const episodeNumber = parsePositiveInt(input.episodeNumber, "episode");
	if (tvId == null || tvId < 1) throw new Error("Invalid TV id");

	return {
		movieId: null,
		tvId,
		seasonNumber,
		episodeNumber,
	};
}

/** Format milliseconds as zero-padded HH:MM:SS for display. */
export function formatQuoteTimestampMs(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0 || !Number.isInteger(ms)) {
		throw new Error(
			"Timestamp must be a non-negative integer millisecond value",
		);
	}

	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return [
		String(hours).padStart(2, "0"),
		String(minutes).padStart(2, "0"),
		String(seconds).padStart(2, "0"),
	].join(":");
}

/**
 * Parse patron-facing timestamp input — `H:MM:SS`, `HH:MM:SS`, or `MM:SS`.
 * Returns null when the field is left blank.
 */
export function parseQuoteTimestampInput(raw: string): number | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const segments = trimmed.split(":").map((part) => part.trim());
	if (segments.length < 2 || segments.length > 3) {
		throw new Error("Timestamp must use MM:SS or HH:MM:SS format");
	}

	const nums = segments.map((part) => {
		if (!/^\d+$/.test(part)) {
			throw new Error("Timestamp must use MM:SS or HH:MM:SS format");
		}
		return Number(part);
	});

	let hours = 0;
	let minutes = 0;
	let seconds = 0;

	if (nums.length === 2) {
		[minutes, seconds] = nums;
	} else {
		[hours, minutes, seconds] = nums;
	}

	if (minutes > 59 || seconds > 59) {
		throw new Error("Timestamp minutes and seconds must be between 00 and 59");
	}

	const totalSeconds = hours * 3600 + minutes * 60 + seconds;
	return totalSeconds * 1000;
}

/** Derive display label from stored milliseconds. */
export function quoteTimestampLabel(
	timestampMs: number | null | undefined,
): string | null {
	if (timestampMs == null) return null;
	return formatQuoteTimestampMs(timestampMs);
}

export function parseListingQuoteSort(
	raw: string | undefined,
): ListingQuoteSort {
	return raw === "newest" ? "newest" : "upvotes";
}

export function parseListingQuoteLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return LISTING_QUOTE_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), LISTING_QUOTE_MAX_LIMIT);
}

/** Map a DB row (+ optional viewer flags) to the public quote DTO. */
export function toListingQuoteItem(
	row: ListingQuoteRow,
	viewer?: { hasUpvoted?: boolean; hasSaved?: boolean },
): ListingQuoteItem {
	return {
		id: row.id,
		body: row.body,
		speaker: row.speaker,
		timestampMs: row.timestampMs,
		timestampLabel: quoteTimestampLabel(row.timestampMs),
		source: row.source,
		upvoteCount: row.upvoteCount,
		seasonNumber: row.seasonNumber,
		episodeNumber: row.episodeNumber,
		...(viewer?.hasUpvoted != null
			? { viewerHasUpvoted: viewer.hasUpvoted }
			: {}),
		...(viewer?.hasSaved != null ? { viewerHasSaved: viewer.hasSaved } : {}),
	};
}

function parsePositiveInt(value: unknown, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new Error(`${label} is required for TV quotes`);
	}
	const n = Math.trunc(value);
	if (n < 1) throw new Error(`${label} must be at least 1`);
	return n;
}
