import { db, movie } from "@still/db";
import { eq } from "drizzle-orm";
import type { NormalizedQuote, QuoteProvider } from "./quote-provider";
import {
	normalizeTitleForQuoteMatch,
	parseSpeakerPrefixedQuoteLine,
} from "./quote-title-match";

/** Free, keyless bulk catalog — https://movie-quotes-api.vercel.app */
export const MOVIEFAMOUS_PROVIDER_SLUG = "moviefamous";
const MOVIEFAMOUS_CATALOG_URL =
	"https://movie-quotes-api.vercel.app/api/v1/quotes";
const CATALOG_CACHE_MS = 24 * 60 * 60_000;

export type MoviefamousCatalogEntry = {
	id: number;
	title: string;
	year: string;
	quotes: string[];
};

type MoviefamousCatalogResponse = {
	status?: string;
	data?: MoviefamousCatalogEntry[];
};

let catalogCache: MoviefamousCatalogEntry[] | null = null;
let catalogCachedAt = 0;

/** Test hook — reset in-memory catalog cache. */
export function resetMoviefamousCatalogCache(): void {
	catalogCache = null;
	catalogCachedAt = 0;
}

async function fetchMoviefamousCatalog(): Promise<MoviefamousCatalogEntry[]> {
	if (catalogCache && Date.now() - catalogCachedAt < CATALOG_CACHE_MS) {
		return catalogCache;
	}
	const res = await fetch(MOVIEFAMOUS_CATALOG_URL, {
		headers: { Accept: "application/json" },
	});
	if (!res.ok) {
		throw new Error(`Moviefamous catalog ${res.status}`);
	}
	const payload = (await res.json()) as MoviefamousCatalogResponse;
	const data = Array.isArray(payload.data) ? payload.data : [];
	catalogCache = data;
	catalogCachedAt = Date.now();
	return data;
}

/** Pick the catalog row that best matches our cached TMDb title/year. */
export function matchMoviefamousCatalogEntry(
	catalog: MoviefamousCatalogEntry[],
	title: string,
	year: number | null,
): MoviefamousCatalogEntry | null {
	const needle = normalizeTitleForQuoteMatch(title);
	const matches = catalog.filter(
		(entry) => normalizeTitleForQuoteMatch(entry.title) === needle,
	);
	if (matches.length === 0) return null;
	if (year != null) {
		const yearStr = String(year);
		const exactYear = matches.find((entry) => entry.year === yearStr);
		if (exactYear) return exactYear;
	}
	return matches[0] ?? null;
}

export function mapMoviefamousEntryToQuotes(
	entry: MoviefamousCatalogEntry,
): NormalizedQuote[] {
	const quotes: NormalizedQuote[] = [];
	for (let index = 0; index < entry.quotes.length; index += 1) {
		const parsed = parseSpeakerPrefixedQuoteLine(entry.quotes[index] ?? "");
		if (!parsed.body) continue;
		quotes.push({
			externalId: `${entry.id}:${index}`,
			body: parsed.body,
			speaker: parsed.speaker ?? undefined,
		});
	}
	return quotes;
}

/** Fetch quotes for a TMDb film from the free bulk catalog. */
export async function fetchMovieQuotesFromMoviefamous(
	tmdbMovieId: number,
): Promise<NormalizedQuote[]> {
	const [row] = await db
		.select({ title: movie.title, year: movie.year })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbMovieId))
		.limit(1);
	if (!row?.title) return [];

	const catalog = await fetchMoviefamousCatalog();
	const entry = matchMoviefamousCatalogEntry(catalog, row.title, row.year);
	if (!entry) return [];

	return mapMoviefamousEntryToQuotes(entry);
}

export function createMoviefamousQuoteProvider(): QuoteProvider {
	return {
		fetchMovieQuotes: fetchMovieQuotesFromMoviefamous,
	};
}
