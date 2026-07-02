import type { ContentVisibility } from "@still/db";
import { db, listingQuote, listingQuoteSave, movie, tv } from "@still/db";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { communityOffset, parseCommunityPage } from "./community-page-args";
import {
	type ListingQuoteItem,
	parseListingQuoteLimit,
	toListingQuoteItem,
} from "./listing-quote";
import { normalizePinnedQuoteSaveIds } from "./profile-pinned-quotes";
import { tmdbImg } from "./tmdb";

export type SavedQuoteListingKind = "movie" | "tv";

export type SavedQuoteListingThumb = {
	kind: SavedQuoteListingKind;
	id: number;
	title: string;
	posterPath: string | null;
	posterUrl: string | null;
	year: number | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
};

export type SavedQuoteLobbyItem = {
	saveId: string;
	savedAt: Date;
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

/** `/quotes` lobby filter — movies vs TV saves only. */
export function parseSavedQuotesKind(
	raw: string | undefined,
): SavedQuoteListingKind | null {
	if (raw === "movie" || raw === "tv") return raw;
	return null;
}

/** Owner lobby visibility slice — omitted means all visibilities. */
export function parseSavedQuotesVisibility(
	raw: string | undefined,
): ContentVisibility | null {
	if (
		raw === "public" ||
		raw === "private" ||
		raw === "followers" ||
		raw === "friends"
	) {
		return raw;
	}
	return null;
}

function buildListingThumb(args: {
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

function mapSavedQuoteRow(row: {
	save: typeof listingQuoteSave.$inferSelect;
	quote: typeof listingQuote.$inferSelect;
	movieTitle: string | null;
	tvTitle: string | null;
	moviePosterPath: string | null;
	tvPosterPath: string | null;
	movieYear: number | null;
	tvYear: number | null;
}): SavedQuoteLobbyItem | null {
	const listing = buildListingThumb({
		movieId: row.quote.movieId,
		tvId: row.quote.tvId,
		movieTitle: row.movieTitle,
		tvTitle: row.tvTitle,
		moviePosterPath: row.moviePosterPath,
		tvPosterPath: row.tvPosterPath,
		movieYear: row.movieYear,
		tvYear: row.tvYear,
		seasonNumber: row.quote.seasonNumber,
		episodeNumber: row.quote.episodeNumber,
	});
	if (!listing) return null;

	return {
		saveId: row.save.id,
		savedAt: row.save.savedAt,
		visibility: row.save.visibility,
		quote: toListingQuoteItem(row.quote),
		listing,
	};
}

async function fetchSavedQuotesPage(args: {
	userId: string;
	page?: string;
	limit?: string;
	kind?: string;
	visibility?: ContentVisibility | null;
	publicOnly?: boolean;
}): Promise<SavedQuotesPage> {
	const page = parseCommunityPage(args.page);
	const limit = parseListingQuoteLimit(args.limit);
	const offset = communityOffset(page, limit);
	const kind = parseSavedQuotesKind(args.kind);

	const filters: SQL[] = [eq(listingQuoteSave.userId, args.userId)];
	if (args.publicOnly) {
		filters.push(eq(listingQuoteSave.visibility, "public"));
	} else if (args.visibility) {
		filters.push(eq(listingQuoteSave.visibility, args.visibility));
	}
	if (kind === "movie") {
		filters.push(isNotNull(listingQuote.movieId));
	}
	if (kind === "tv") {
		filters.push(isNotNull(listingQuote.tvId));
	}

	const rows = await db
		.select({
			save: listingQuoteSave,
			quote: listingQuote,
			movieTitle: movie.title,
			tvTitle: tv.title,
			moviePosterPath: movie.posterPath,
			tvPosterPath: tv.posterPath,
			movieYear: movie.year,
			tvYear: tv.year,
		})
		.from(listingQuoteSave)
		.innerJoin(listingQuote, eq(listingQuoteSave.quoteId, listingQuote.id))
		.leftJoin(movie, eq(listingQuote.movieId, movie.tmdbId))
		.leftJoin(tv, eq(listingQuote.tvId, tv.tmdbId))
		.where(and(...filters))
		.orderBy(desc(listingQuoteSave.savedAt), desc(listingQuoteSave.id))
		.limit(limit + 1)
		.offset(offset);

	const hasMore = rows.length > limit;
	const slice = hasMore ? rows.slice(0, limit) : rows;
	const items = slice
		.map((row) => mapSavedQuoteRow(row))
		.filter((item): item is SavedQuoteLobbyItem => item != null);

	return { items, page, limit, hasMore };
}

/** Signed-in patron collection for `/quotes` lobby. */
export async function fetchMySavedQuotes(args: {
	userId: string;
	page?: string;
	limit?: string;
	kind?: string;
	visibility?: string;
}): Promise<SavedQuotesPage> {
	return fetchSavedQuotesPage({
		userId: args.userId,
		page: args.page,
		limit: args.limit,
		kind: args.kind,
		visibility: parseSavedQuotesVisibility(args.visibility),
		publicOnly: false,
	});
}

/** Visitor-safe pinned quotes on a profile — caller must enforce profile access. */
export async function fetchProfilePinnedQuotes(args: {
	userId: string;
	rawSaveIds: unknown;
	publicOnly: boolean;
	page?: string;
	limit?: string;
	kind?: string;
}): Promise<SavedQuotesPage> {
	const saveIds = normalizePinnedQuoteSaveIds(args.rawSaveIds);
	const page = parseCommunityPage(args.page);
	const limit = parseListingQuoteLimit(args.limit);
	if (saveIds.length === 0) {
		return { items: [], page, limit, hasMore: false };
	}

	const kind = parseSavedQuotesKind(args.kind);
	const filters: SQL[] = [
		eq(listingQuoteSave.userId, args.userId),
		inArray(listingQuoteSave.id, saveIds),
	];
	if (args.publicOnly) {
		filters.push(eq(listingQuoteSave.visibility, "public"));
	}
	if (kind === "movie") {
		filters.push(isNotNull(listingQuote.movieId));
	} else if (kind === "tv") {
		filters.push(isNotNull(listingQuote.tvId));
	}

	const rows = await db
		.select({
			save: listingQuoteSave,
			quote: listingQuote,
			movieTitle: movie.title,
			tvTitle: tv.title,
			moviePosterPath: movie.posterPath,
			tvPosterPath: tv.posterPath,
			movieYear: movie.year,
			tvYear: tv.year,
		})
		.from(listingQuoteSave)
		.innerJoin(listingQuote, eq(listingQuoteSave.quoteId, listingQuote.id))
		.leftJoin(movie, eq(listingQuote.movieId, movie.tmdbId))
		.leftJoin(tv, eq(listingQuote.tvId, tv.tmdbId))
		.where(and(...filters));

	const bySaveId = new Map(
		rows
			.map((row) => mapSavedQuoteRow(row))
			.filter((item): item is SavedQuoteLobbyItem => item != null)
			.map((item) => [item.saveId, item] as const),
	);
	const items = saveIds
		.map((id) => bySaveId.get(id))
		.filter((item): item is SavedQuoteLobbyItem => item != null);

	const offset = communityOffset(page, limit);
	const slice = items.slice(offset, offset + limit);
	const hasMore = offset + limit < items.length;

	return { items: slice, page, limit, hasMore };
}

/** @deprecated Use fetchProfilePinnedQuotes — profile strip shows pins only. */
export async function fetchProfilePublicSavedQuotes(args: {
	userId: string;
	page?: string;
	limit?: string;
	kind?: string;
}): Promise<SavedQuotesPage> {
	return fetchProfilePinnedQuotes({
		userId: args.userId,
		rawSaveIds: [],
		publicOnly: true,
		page: args.page,
		limit: args.limit,
		kind: args.kind,
	});
}
