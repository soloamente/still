import type { ListingQuoteSource } from "@still/db";
import { db, listingQuote } from "@still/db";
import { and, eq } from "drizzle-orm";

import { makeId } from "./cuid";
import { ensureMovieCached } from "./ensure-movie-cached";
import {
	type ListingQuoteScope,
	splitQuoteBodyForImport,
	validateListingQuoteScope,
	validateQuoteBody,
	validateQuoteSpeaker,
} from "./listing-quote";
import type { NormalizedQuote } from "./quote-provider";
import {
	isQuoteImportEnabled,
	quoteProviderSlugFromEnv,
	resolveQuoteProvider,
} from "./quote-provider";
import { assertListingCached } from "./quote-submission";

/** Avoid re-hitting upstream when a title has no provider coverage. */
const QUOTE_IMPORT_COOLDOWN_MS = 24 * 60 * 60_000;
const quoteImportAttemptedAt = new Map<number, number>();

export type QuoteImportUpsertResult =
	| "inserted"
	| "updated"
	| "skipped_protected"
	| "skipped_listing"
	| "skipped_invalid";

export type QuoteImportBatchResult = {
	inserted: number;
	updated: number;
	skippedProtected: number;
	skippedListing: number;
	skippedInvalid: number;
	provider: string | null;
};

/** Import must never clobber curated staff lines or approved patron submissions. */
export function shouldProtectQuoteFromImportOverwrite(
	source: ListingQuoteSource,
): boolean {
	return source === "staff" || source === "patron";
}

function scopeFromNormalizedQuote(args: {
	movieId?: number;
	tvId?: number;
	quote: NormalizedQuote;
}): ListingQuoteScope {
	return validateListingQuoteScope({
		movieId: args.movieId ?? null,
		tvId: args.tvId ?? null,
		seasonNumber: args.quote.seasonNumber ?? null,
		episodeNumber: args.quote.episodeNumber ?? null,
	});
}

/** Upsert one external quote row keyed by `(externalProvider, externalId)`. */
export async function upsertImportedQuote(args: {
	providerSlug: string;
	scope: ListingQuoteScope;
	quote: NormalizedQuote;
}): Promise<QuoteImportUpsertResult> {
	const cached = await assertListingCached(args.scope);
	if (!cached) return "skipped_listing";

	const body = validateQuoteBody(args.quote.body);
	const speaker = validateQuoteSpeaker(args.quote.speaker ?? null);
	const externalId = args.quote.externalId.trim();
	if (!externalId) {
		throw new Error("Import quote requires externalId");
	}

	const [existing] = await db
		.select({
			id: listingQuote.id,
			source: listingQuote.source,
		})
		.from(listingQuote)
		.where(
			and(
				eq(listingQuote.externalProvider, args.providerSlug),
				eq(listingQuote.externalId, externalId),
			),
		)
		.limit(1);

	if (existing) {
		if (shouldProtectQuoteFromImportOverwrite(existing.source)) {
			return "skipped_protected";
		}
		await db
			.update(listingQuote)
			.set({
				body,
				speaker,
				timestampMs: args.quote.timestampMs ?? null,
				movieId: args.scope.movieId,
				tvId: args.scope.tvId,
				seasonNumber: args.scope.seasonNumber,
				episodeNumber: args.scope.episodeNumber,
			})
			.where(eq(listingQuote.id, existing.id));
		return "updated";
	}

	await db.insert(listingQuote).values({
		id: makeId("lquote"),
		movieId: args.scope.movieId,
		tvId: args.scope.tvId,
		seasonNumber: args.scope.seasonNumber,
		episodeNumber: args.scope.episodeNumber,
		body,
		speaker,
		timestampMs: args.quote.timestampMs ?? null,
		source: "external_api",
		submittedByUserId: null,
		externalProvider: args.providerSlug,
		externalId,
		upvoteCount: 0,
	});

	return "inserted";
}

/** Skip invalid upstream rows instead of aborting the whole film import. */
async function upsertImportedQuoteSafe(args: {
	providerSlug: string;
	scope: ListingQuoteScope;
	quote: NormalizedQuote;
}): Promise<QuoteImportUpsertResult> {
	try {
		return await upsertImportedQuote(args);
	} catch (err) {
		console.warn("[quote-import] skipped invalid quote row", {
			externalId: args.quote.externalId,
			message: err instanceof Error ? err.message : String(err),
		});
		return "skipped_invalid";
	}
}

/** Batch upsert for a movie listing when import is enabled. */
export async function importMovieQuotesFromProvider(
	tmdbMovieId: number,
): Promise<QuoteImportBatchResult> {
	const providerSlug = quoteProviderSlugFromEnv();
	const provider = resolveQuoteProvider();
	const empty: QuoteImportBatchResult = {
		inserted: 0,
		updated: 0,
		skippedProtected: 0,
		skippedListing: 0,
		skippedInvalid: 0,
		provider: providerSlug,
	};
	if (!provider || !providerSlug) return empty;

	const quotes = await provider.fetchMovieQuotes(tmdbMovieId);
	const counts = { ...empty };

	for (const quote of quotes) {
		const scope = scopeFromNormalizedQuote({ movieId: tmdbMovieId, quote });
		const bodyChunks = splitQuoteBodyForImport(quote.body);
		for (let chunkIndex = 0; chunkIndex < bodyChunks.length; chunkIndex += 1) {
			const chunkBody = bodyChunks[chunkIndex];
			if (!chunkBody) continue;
			const chunkQuote: NormalizedQuote = {
				...quote,
				body: chunkBody,
				externalId:
					bodyChunks.length > 1
						? `${quote.externalId}#${chunkIndex}`
						: quote.externalId,
			};
			const result = await upsertImportedQuoteSafe({
				providerSlug,
				scope,
				quote: chunkQuote,
			});
			if (result === "inserted") counts.inserted += 1;
			else if (result === "updated") counts.updated += 1;
			else if (result === "skipped_protected") counts.skippedProtected += 1;
			else if (result === "skipped_invalid") counts.skippedInvalid += 1;
			else counts.skippedListing += 1;
		}
	}

	return counts;
}

function shouldSkipQuoteImportAttempt(
	movieId: number,
	force: boolean,
): boolean {
	if (force) return false;
	const last = quoteImportAttemptedAt.get(movieId);
	if (last == null) return false;
	return Date.now() - last < QUOTE_IMPORT_COOLDOWN_MS;
}

/** True when this film already has rows from the active external provider. */
export async function movieHasImportedQuotes(
	movieId: number,
	providerSlug: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: listingQuote.id })
		.from(listingQuote)
		.where(
			and(
				eq(listingQuote.movieId, movieId),
				eq(listingQuote.externalProvider, providerSlug),
			),
		)
		.limit(1);
	return Boolean(row);
}

/**
 * Lazy seed — runs on first Quotes tab fetch when import is enabled.
 * Skips when provider rows already exist or a recent attempt failed empty.
 */
export async function maybeImportMovieQuotesIfNeeded(
	movieId: number,
	options?: { force?: boolean },
): Promise<QuoteImportBatchResult | null> {
	if (!isQuoteImportEnabled()) return null;

	const providerSlug = quoteProviderSlugFromEnv();
	const provider = resolveQuoteProvider();
	if (!provider || !providerSlug) return null;

	if (await movieHasImportedQuotes(movieId, providerSlug)) {
		return null;
	}
	if (shouldSkipQuoteImportAttempt(movieId, options?.force === true)) {
		return null;
	}

	await ensureMovieCached(movieId);

	try {
		const result = await importMovieQuotesFromProvider(movieId);
		// Cooldown only after a completed attempt (including zero-match catalogs).
		quoteImportAttemptedAt.set(movieId, Date.now());
		return result;
	} catch (err) {
		console.error("[quote-import] movie import failed", { movieId, err });
		return null;
	}
}

/** Staff/manual import — bypasses cooldown, still respects protected rows. */
export async function importMovieQuotesNow(
	movieId: number,
): Promise<QuoteImportBatchResult> {
	await ensureMovieCached(movieId);
	quoteImportAttemptedAt.delete(movieId);
	return importMovieQuotesFromProvider(movieId);
}
