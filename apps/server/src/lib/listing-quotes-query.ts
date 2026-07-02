import type { ContentVisibility } from "@still/db";
import {
	db,
	listingQuote,
	listingQuoteSave,
	listingQuoteUpvote,
} from "@still/db";
import { and, desc, eq, inArray } from "drizzle-orm";

import { communityOffset, parseCommunityPage } from "./community-page-args";
import { makeId } from "./cuid";
import {
	type ListingQuoteItem,
	parseListingQuoteLimit,
	parseListingQuoteSort,
	toListingQuoteItem,
} from "./listing-quote";
import { maybeImportMovieQuotesIfNeeded } from "./quote-import";

type ListingQuoteRow = typeof listingQuote.$inferSelect;

export type ListingQuotesPage = {
	items: ListingQuoteItem[];
	page: number;
	limit: number;
	hasMore: boolean;
};

/** TV list endpoints require positive season + episode query params. */
export function parseTvQuoteEpisodeParams(query: {
	season?: string;
	episode?: string;
}): { seasonNumber: number; episodeNumber: number } | null {
	const seasonNumber = Number(query.season);
	const episodeNumber = Number(query.episode);
	if (
		!Number.isFinite(seasonNumber) ||
		!Number.isFinite(episodeNumber) ||
		seasonNumber < 1 ||
		episodeNumber < 1
	) {
		return null;
	}
	return {
		seasonNumber: Math.trunc(seasonNumber),
		episodeNumber: Math.trunc(episodeNumber),
	};
}

/** Published quotes for a film detail tab. */
export async function fetchListingQuotesForMovie(args: {
	movieId: number;
	sort?: string;
	page?: string;
	limit?: string;
	viewerUserId?: string | null;
}): Promise<ListingQuotesPage> {
	const page = parseCommunityPage(args.page);
	if (page === 1) {
		await maybeImportMovieQuotesIfNeeded(args.movieId);
	}
	return fetchListingQuotesPage({
		where: eq(listingQuote.movieId, args.movieId),
		sort: args.sort,
		page: args.page,
		limit: args.limit,
		viewerUserId: args.viewerUserId,
	});
}

/** Published quotes for a TV episode detail tab. */
export async function fetchListingQuotesForTv(args: {
	tvId: number;
	seasonNumber: number;
	episodeNumber: number;
	sort?: string;
	page?: string;
	limit?: string;
	viewerUserId?: string | null;
}): Promise<ListingQuotesPage> {
	return fetchListingQuotesPage({
		where: and(
			eq(listingQuote.tvId, args.tvId),
			eq(listingQuote.seasonNumber, args.seasonNumber),
			eq(listingQuote.episodeNumber, args.episodeNumber),
		),
		sort: args.sort,
		page: args.page,
		limit: args.limit,
		viewerUserId: args.viewerUserId,
	});
}

/** Single published quote by id — null when missing. */
export async function fetchListingQuoteById(
	quoteId: string,
	viewerUserId?: string | null,
): Promise<ListingQuoteItem | null> {
	const [row] = await db
		.select()
		.from(listingQuote)
		.where(eq(listingQuote.id, quoteId))
		.limit(1);
	if (!row) return null;
	const [item] = await attachViewerQuoteFlags([row], viewerUserId ?? null);
	return item ?? null;
}

async function fetchListingQuotesPage(args: {
	where: ReturnType<typeof eq> | ReturnType<typeof and>;
	sort?: string;
	page?: string;
	limit?: string;
	viewerUserId?: string | null;
}): Promise<ListingQuotesPage> {
	const page = parseCommunityPage(args.page);
	const limit = parseListingQuoteLimit(args.limit);
	const offset = communityOffset(page, limit);
	const sort = parseListingQuoteSort(args.sort);

	const orderBy =
		sort === "newest"
			? [desc(listingQuote.publishedAt), desc(listingQuote.upvoteCount)]
			: [desc(listingQuote.upvoteCount), desc(listingQuote.publishedAt)];

	const rows = await db
		.select()
		.from(listingQuote)
		.where(args.where)
		.orderBy(...orderBy)
		.limit(limit + 1)
		.offset(offset);

	const hasMore = rows.length > limit;
	const slice = hasMore ? rows.slice(0, limit) : rows;
	const items = await attachViewerQuoteFlags(slice, args.viewerUserId ?? null);

	return {
		items,
		page,
		limit,
		hasMore,
	};
}

async function attachViewerQuoteFlags(
	rows: ListingQuoteRow[],
	viewerUserId: string | null,
): Promise<ListingQuoteItem[]> {
	if (rows.length === 0) return [];
	if (!viewerUserId) {
		return rows.map((row) => toListingQuoteItem(row));
	}

	const quoteIds = rows.map((row) => row.id);
	const [upvotes, saves] = await Promise.all([
		db
			.select({ quoteId: listingQuoteUpvote.quoteId })
			.from(listingQuoteUpvote)
			.where(
				and(
					eq(listingQuoteUpvote.userId, viewerUserId),
					inArray(listingQuoteUpvote.quoteId, quoteIds),
				),
			),
		db
			.select({ quoteId: listingQuoteSave.quoteId })
			.from(listingQuoteSave)
			.where(
				and(
					eq(listingQuoteSave.userId, viewerUserId),
					inArray(listingQuoteSave.quoteId, quoteIds),
				),
			),
	]);

	const upvoted = new Set(upvotes.map((row) => row.quoteId));
	const saved = new Set(saves.map((row) => row.quoteId));

	return rows.map((row) =>
		toListingQuoteItem(row, {
			hasUpvoted: upvoted.has(row.id),
			hasSaved: saved.has(row.id),
		}),
	);
}

/** Toggle patron upvote — returns next state + count. */
export async function toggleListingQuoteUpvote(
	userId: string,
	quoteId: string,
): Promise<{ upvoted: boolean; upvoteCount: number } | null> {
	const [quoteRow] = await db
		.select({ id: listingQuote.id, upvoteCount: listingQuote.upvoteCount })
		.from(listingQuote)
		.where(eq(listingQuote.id, quoteId))
		.limit(1);
	if (!quoteRow) return null;

	const [existing] = await db
		.select({ quoteId: listingQuoteUpvote.quoteId })
		.from(listingQuoteUpvote)
		.where(
			and(
				eq(listingQuoteUpvote.userId, userId),
				eq(listingQuoteUpvote.quoteId, quoteId),
			),
		)
		.limit(1);

	if (existing) {
		await db
			.delete(listingQuoteUpvote)
			.where(
				and(
					eq(listingQuoteUpvote.userId, userId),
					eq(listingQuoteUpvote.quoteId, quoteId),
				),
			);
		const nextCount = Math.max(0, quoteRow.upvoteCount - 1);
		await db
			.update(listingQuote)
			.set({ upvoteCount: nextCount })
			.where(eq(listingQuote.id, quoteId));
		return { upvoted: false, upvoteCount: nextCount };
	}

	await db.insert(listingQuoteUpvote).values({
		userId,
		quoteId,
	});
	const nextCount = quoteRow.upvoteCount + 1;
	await db
		.update(listingQuote)
		.set({ upvoteCount: nextCount })
		.where(eq(listingQuote.id, quoteId));
	return { upvoted: true, upvoteCount: nextCount };
}

/** New saves default to private bookmarks in `/quotes` — pin separately for profile. */
function resolveQuoteSaveVisibility(
	explicit?: ContentVisibility,
): ContentVisibility {
	return explicit ?? "private";
}

/** Save a published quote — idempotent when already saved. */
export async function saveListingQuote(args: {
	userId: string;
	quoteId: string;
	visibility?: ContentVisibility;
}): Promise<{
	saveId: string;
	visibility: ContentVisibility;
	created: boolean;
} | null> {
	const [quoteRow] = await db
		.select({ id: listingQuote.id })
		.from(listingQuote)
		.where(eq(listingQuote.id, args.quoteId))
		.limit(1);
	if (!quoteRow) return null;

	const visibility = resolveQuoteSaveVisibility(args.visibility);

	const [existing] = await db
		.select({
			id: listingQuoteSave.id,
			visibility: listingQuoteSave.visibility,
		})
		.from(listingQuoteSave)
		.where(
			and(
				eq(listingQuoteSave.userId, args.userId),
				eq(listingQuoteSave.quoteId, args.quoteId),
			),
		)
		.limit(1);

	if (existing) {
		return {
			saveId: existing.id,
			visibility: existing.visibility,
			created: false,
		};
	}

	const saveId = makeId("qsave");
	await db.insert(listingQuoteSave).values({
		id: saveId,
		userId: args.userId,
		quoteId: args.quoteId,
		visibility,
	});
	return { saveId, visibility, created: true };
}

/** Update visibility on a patron's saved quote row. */
export async function patchListingQuoteSaveVisibility(args: {
	userId: string;
	saveId: string;
	visibility: ContentVisibility;
}): Promise<{ saveId: string; visibility: ContentVisibility } | null> {
	const [existing] = await db
		.select({ id: listingQuoteSave.id })
		.from(listingQuoteSave)
		.where(
			and(
				eq(listingQuoteSave.id, args.saveId),
				eq(listingQuoteSave.userId, args.userId),
			),
		)
		.limit(1);
	if (!existing) return null;

	await db
		.update(listingQuoteSave)
		.set({ visibility: args.visibility })
		.where(eq(listingQuoteSave.id, args.saveId));

	return { saveId: args.saveId, visibility: args.visibility };
}

/** Remove a patron's saved quote bookmark. */
export async function deleteListingQuoteSave(args: {
	userId: string;
	saveId: string;
}): Promise<{ quoteId: string } | null> {
	const [existing] = await db
		.select({
			id: listingQuoteSave.id,
			quoteId: listingQuoteSave.quoteId,
		})
		.from(listingQuoteSave)
		.where(
			and(
				eq(listingQuoteSave.id, args.saveId),
				eq(listingQuoteSave.userId, args.userId),
			),
		)
		.limit(1);
	if (!existing) return null;

	await db.delete(listingQuoteSave).where(eq(listingQuoteSave.id, args.saveId));
	return { quoteId: existing.quoteId };
}
