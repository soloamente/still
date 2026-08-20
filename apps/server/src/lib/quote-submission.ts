import type { QuoteSubmissionStatus } from "@still/db";
import {
	db,
	listingQuote,
	movie,
	profile,
	quoteSubmission,
	tv,
} from "@still/db";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { communityOffset, parseCommunityPage } from "./community-page-args";
import { makeId } from "./cuid";
import { ensureMovieCached } from "./ensure-movie-cached";
import {
	type ListingQuoteScope,
	parseListingQuoteLimit,
	parseQuoteTimestampInput,
	quoteTimestampLabel,
	validateListingQuoteScope,
	validateQuoteBody,
	validateQuoteSpeaker,
} from "./listing-quote";
import {
	parseSavedQuotesKind,
	type SavedQuoteListingKind,
	type SavedQuoteListingThumb,
} from "./listing-quote-saves-query";
import { deliverNotification } from "./notification-delivery";
import { tmdbImg } from "./tmdb";
import { ensureTvCached } from "./tv-cache";

/** Patron submit cap — 5 pending submissions per rolling 24h window. */
export const QUOTE_SUBMISSION_RATE_LIMIT = 5;
export const QUOTE_SUBMISSION_RATE_WINDOW_MS = 24 * 60 * 60_000;

export type QuoteSubmissionInput = {
	body: string;
	speaker?: string | null;
	timestamp?: string | null;
	movieId?: number | null;
	tvId?: number | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
};

/** Patron `/quotes` submission status filter — omitted means all statuses. */
export type QuoteSubmissionStatusFilter = QuoteSubmissionStatus | "all";

export function parseQuoteSubmissionStatusFilter(
	raw: string | undefined,
): QuoteSubmissionStatusFilter {
	if (raw === "pending" || raw === "approved" || raw === "rejected") {
		return raw;
	}
	return "all";
}

export type QuoteSubmissionLobbyItem = {
	submissionId: string;
	status: QuoteSubmissionStatus;
	body: string;
	speaker: string | null;
	timestampLabel: string | null;
	createdAt: Date;
	reviewedAt: Date | null;
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

export type QuoteSubmissionListItem = {
	id: string;
	status: QuoteSubmissionStatus;
	body: string;
	speaker: string | null;
	timestampMs: number | null;
	timestampLabel: string | null;
	movieId: number | null;
	tvId: number | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	listingTitle: string | null;
	submitter: {
		userId: string;
		handle: string | null;
		displayName: string | null;
	};
	createdAt: Date;
	staffNote: string | null;
	resolvedQuoteId: string | null;
};

/** Deep link to the title Quotes tab after staff approval. */
export function quoteSubmissionNotificationHref(scope: {
	movieId: number | null;
	tvId: number | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
}): string {
	if (scope.movieId != null) {
		return `/movies/${scope.movieId}?view=quotes`;
	}
	if (
		scope.tvId != null &&
		scope.seasonNumber != null &&
		scope.episodeNumber != null
	) {
		const params = new URLSearchParams({
			view: "quotes",
			season: String(scope.seasonNumber),
			episode: String(scope.episodeNumber),
		});
		return `/tv/${scope.tvId}?${params.toString()}`;
	}
	return "/home";
}

/** Normalize patron submit payload before insert. */
export function parseQuoteSubmissionInput(raw: QuoteSubmissionInput): {
	body: string;
	speaker: string | null;
	timestampMs: number | null;
	scope: ListingQuoteScope;
} {
	const body = validateQuoteBody(raw.body);
	const speaker = validateQuoteSpeaker(raw.speaker);
	const timestampMs = parseQuoteTimestampInput(raw.timestamp ?? "");
	const scope = validateListingQuoteScope({
		movieId: raw.movieId,
		tvId: raw.tvId,
		seasonNumber: raw.seasonNumber,
		episodeNumber: raw.episodeNumber,
	});
	return { body, speaker, timestampMs, scope };
}

/** Create a pending patron quote submission. */
export async function createQuoteSubmission(args: {
	userId: string;
	input: QuoteSubmissionInput;
}): Promise<{ submissionId: string }> {
	const parsed = parseQuoteSubmissionInput(args.input);
	const submissionId = makeId("qsub");
	await db.insert(quoteSubmission).values({
		id: submissionId,
		userId: args.userId,
		movieId: parsed.scope.movieId,
		tvId: parsed.scope.tvId,
		seasonNumber: parsed.scope.seasonNumber,
		episodeNumber: parsed.scope.episodeNumber,
		body: parsed.body,
		speaker: parsed.speaker,
		timestampMs: parsed.timestampMs,
		status: "pending",
	});
	return { submissionId };
}

function mapSubmissionRow(
	row: typeof quoteSubmission.$inferSelect,
	meta: {
		handle: string | null;
		displayName: string | null;
		listingTitle: string | null;
	},
): QuoteSubmissionListItem {
	return {
		id: row.id,
		status: row.status,
		body: row.body,
		speaker: row.speaker,
		timestampMs: row.timestampMs,
		timestampLabel: quoteTimestampLabel(row.timestampMs),
		movieId: row.movieId,
		tvId: row.tvId,
		seasonNumber: row.seasonNumber,
		episodeNumber: row.episodeNumber,
		listingTitle: meta.listingTitle,
		submitter: {
			userId: row.userId,
			handle: meta.handle,
			displayName: meta.displayName,
		},
		createdAt: row.createdAt,
		staffNote: row.staffNote,
		resolvedQuoteId: row.resolvedQuoteId,
	};
}

function buildSubmissionListingThumb(args: {
	movieId: number | null;
	tvId: number | null;
	movieTitle: string | null;
	tvTitle: string | null;
	moviePosterPath: string | null;
	tvPosterPath: string | null;
	movieYear: number | null;
	tvYear: number | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
}): SavedQuoteListingThumb | null {
	if (args.movieId != null) {
		return {
			kind: "movie",
			id: args.movieId,
			title: args.movieTitle ?? "Unknown film",
			posterPath: args.moviePosterPath,
			posterUrl: tmdbImg.poster(args.moviePosterPath),
			year: args.movieYear,
			seasonNumber: null,
			episodeNumber: null,
		};
	}
	if (args.tvId != null) {
		return {
			kind: "tv",
			id: args.tvId,
			title: args.tvTitle ?? "Unknown show",
			posterPath: args.tvPosterPath,
			posterUrl: tmdbImg.poster(args.tvPosterPath),
			year: args.tvYear,
			seasonNumber: args.seasonNumber,
			episodeNumber: args.episodeNumber,
		};
	}
	return null;
}

function mapSubmissionLobbyRow(row: {
	submission: typeof quoteSubmission.$inferSelect;
	movieTitle: string | null;
	tvTitle: string | null;
	moviePosterPath: string | null;
	tvPosterPath: string | null;
	movieYear: number | null;
	tvYear: number | null;
}): QuoteSubmissionLobbyItem | null {
	const listing = buildSubmissionListingThumb({
		movieId: row.submission.movieId,
		tvId: row.submission.tvId,
		movieTitle: row.movieTitle,
		tvTitle: row.tvTitle,
		moviePosterPath: row.moviePosterPath,
		tvPosterPath: row.tvPosterPath,
		movieYear: row.movieYear,
		tvYear: row.tvYear,
		seasonNumber: row.submission.seasonNumber,
		episodeNumber: row.submission.episodeNumber,
	});
	if (!listing) return null;

	return {
		submissionId: row.submission.id,
		status: row.submission.status,
		body: row.submission.body,
		speaker: row.submission.speaker,
		timestampLabel: quoteTimestampLabel(row.submission.timestampMs),
		createdAt: row.submission.createdAt,
		reviewedAt: row.submission.reviewedAt,
		staffNote: row.submission.staffNote,
		resolvedQuoteId: row.submission.resolvedQuoteId,
		listing,
	};
}

/** Signed-in patron history on `/quotes` — newest submissions first. */
export async function fetchMyQuoteSubmissions(args: {
	userId: string;
	page?: string;
	limit?: string;
	kind?: string;
	status?: string;
}): Promise<QuoteSubmissionsPage> {
	const page = parseCommunityPage(args.page);
	const limit = parseListingQuoteLimit(args.limit);
	const offset = communityOffset(page, limit);
	const kind = parseSavedQuotesKind(args.kind) as SavedQuoteListingKind | null;
	const status = parseQuoteSubmissionStatusFilter(args.status);

	const filters: SQL[] = [eq(quoteSubmission.userId, args.userId)];
	if (status !== "all") {
		filters.push(eq(quoteSubmission.status, status));
	}
	if (kind === "movie") {
		filters.push(isNotNull(quoteSubmission.movieId));
	}
	if (kind === "tv") {
		filters.push(isNotNull(quoteSubmission.tvId));
	}

	const rows = await db
		.select({
			submission: quoteSubmission,
			movieTitle: movie.title,
			tvTitle: tv.title,
			moviePosterPath: movie.posterPath,
			tvPosterPath: tv.posterPath,
			movieYear: movie.year,
			tvYear: tv.year,
		})
		.from(quoteSubmission)
		.leftJoin(movie, eq(quoteSubmission.movieId, movie.tmdbId))
		.leftJoin(tv, eq(quoteSubmission.tvId, tv.tmdbId))
		.where(and(...filters))
		.orderBy(desc(quoteSubmission.createdAt), desc(quoteSubmission.id))
		.limit(limit + 1)
		.offset(offset);

	const hasMore = rows.length > limit;
	const slice = hasMore ? rows.slice(0, limit) : rows;
	const items = slice
		.map((row) => mapSubmissionLobbyRow(row))
		.filter((item): item is QuoteSubmissionLobbyItem => item != null);

	return { items, page, limit, hasMore };
}

/** Staff queue — newest first, optional status filter. */
export async function listQuoteSubmissions(args: {
	status?: QuoteSubmissionStatus;
	limit?: number;
}): Promise<QuoteSubmissionListItem[]> {
	const status = args.status ?? "pending";
	const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

	const rows = await db
		.select({
			submission: quoteSubmission,
			handle: profile.handle,
			displayName: profile.displayName,
			movieTitle: movie.title,
			tvTitle: tv.title,
		})
		.from(quoteSubmission)
		.leftJoin(profile, eq(quoteSubmission.userId, profile.userId))
		.leftJoin(movie, eq(quoteSubmission.movieId, movie.tmdbId))
		.leftJoin(tv, eq(quoteSubmission.tvId, tv.tmdbId))
		.where(eq(quoteSubmission.status, status))
		.orderBy(desc(quoteSubmission.createdAt))
		.limit(limit);

	return rows.map((row) =>
		mapSubmissionRow(row.submission, {
			handle: row.handle,
			displayName: row.displayName,
			listingTitle: row.movieTitle ?? row.tvTitle ?? null,
		}),
	);
}

/** Ensure TMDb title exists in cache before publishing or importing quotes. */
export async function assertListingCached(
	scope: ListingQuoteScope,
): Promise<boolean> {
	if (scope.movieId != null) {
		await ensureMovieCached(scope.movieId);
		const [row] = await db
			.select({ id: movie.tmdbId })
			.from(movie)
			.where(eq(movie.tmdbId, scope.movieId))
			.limit(1);
		return Boolean(row);
	}
	if (scope.tvId != null) {
		return ensureTvCached(scope.tvId);
	}
	return false;
}

/** Approve a pending submission — publishes catalog row + notifies submitter. */
export async function approveQuoteSubmission(args: {
	submissionId: string;
	reviewerUserId: string;
}): Promise<
	| { quoteId: string; submission: QuoteSubmissionListItem }
	| { error: "not_found" | "not_pending" | "listing_missing" }
> {
	const [row] = await db
		.select()
		.from(quoteSubmission)
		.where(eq(quoteSubmission.id, args.submissionId))
		.limit(1);
	if (!row) return { error: "not_found" };
	if (row.status !== "pending") return { error: "not_pending" };

	const scope = validateListingQuoteScope({
		movieId: row.movieId,
		tvId: row.tvId,
		seasonNumber: row.seasonNumber,
		episodeNumber: row.episodeNumber,
	});
	const cached = await assertListingCached(scope);
	if (!cached) return { error: "listing_missing" };

	const quoteId = makeId("lquote");
	await db.insert(listingQuote).values({
		id: quoteId,
		movieId: scope.movieId,
		tvId: scope.tvId,
		seasonNumber: scope.seasonNumber,
		episodeNumber: scope.episodeNumber,
		body: row.body,
		speaker: row.speaker,
		timestampMs: row.timestampMs,
		source: "patron",
		submittedByUserId: row.userId,
		upvoteCount: 0,
	});

	const reviewedAt = new Date();
	await db
		.update(quoteSubmission)
		.set({
			status: "approved",
			reviewedByUserId: args.reviewerUserId,
			reviewedAt,
			resolvedQuoteId: quoteId,
		})
		.where(eq(quoteSubmission.id, args.submissionId));

	const href = quoteSubmissionNotificationHref(scope);
	await deliverNotification({
		userId: row.userId,
		kind: "quote.submission.approved",
		title: "Your quote was approved",
		body: "It is now live on the title Quotes tab.",
		payload: {
			submissionId: row.id,
			quoteId,
			href,
			movieId: scope.movieId,
			tvId: scope.tvId,
			seasonNumber: scope.seasonNumber,
			episodeNumber: scope.episodeNumber,
		},
	});

	const [submitterProfile] = await db
		.select({ handle: profile.handle, displayName: profile.displayName })
		.from(profile)
		.where(eq(profile.userId, row.userId))
		.limit(1);

	return {
		quoteId,
		submission: mapSubmissionRow(
			{
				...row,
				status: "approved",
				reviewedByUserId: args.reviewerUserId,
				reviewedAt,
				resolvedQuoteId: quoteId,
			},
			{
				handle: submitterProfile?.handle ?? null,
				displayName: submitterProfile?.displayName ?? null,
				listingTitle: null,
			},
		),
	};
}

/** Reject a pending submission — optional staff note + notifies submitter. */
export async function rejectQuoteSubmission(args: {
	submissionId: string;
	reviewerUserId: string;
	staffNote?: string | null;
}): Promise<
	| { submission: QuoteSubmissionListItem }
	| { error: "not_found" | "not_pending" }
> {
	const [row] = await db
		.select()
		.from(quoteSubmission)
		.where(eq(quoteSubmission.id, args.submissionId))
		.limit(1);
	if (!row) return { error: "not_found" };
	if (row.status !== "pending") return { error: "not_pending" };

	const staffNote = args.staffNote?.trim() || null;
	const reviewedAt = new Date();

	await db
		.update(quoteSubmission)
		.set({
			status: "rejected",
			staffNote,
			reviewedByUserId: args.reviewerUserId,
			reviewedAt,
		})
		.where(eq(quoteSubmission.id, args.submissionId));

	const payload: Record<string, unknown> = {
		submissionId: row.id,
		movieId: row.movieId,
		tvId: row.tvId,
	};
	if (staffNote) payload.staffNote = staffNote;

	await deliverNotification({
		userId: row.userId,
		kind: "quote.submission.rejected",
		title: "Your quote was not approved",
		body: staffNote ?? "Staff did not add this line to the catalog.",
		payload,
	});

	const [submitterProfile] = await db
		.select({ handle: profile.handle, displayName: profile.displayName })
		.from(profile)
		.where(eq(profile.userId, row.userId))
		.limit(1);

	return {
		submission: mapSubmissionRow(
			{
				...row,
				status: "rejected",
				staffNote,
				reviewedByUserId: args.reviewerUserId,
				reviewedAt,
			},
			{
				handle: submitterProfile?.handle ?? null,
				displayName: submitterProfile?.displayName ?? null,
				listingTitle: null,
			},
		),
	};
}
