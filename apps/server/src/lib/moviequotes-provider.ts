import { db, movie } from "@still/db";
import { env } from "@still/env/server";
import { eq } from "drizzle-orm";

import { titleToMovieQuotesSlug } from "./moviequotes-slug";
import type { NormalizedQuote, QuoteProvider } from "./quote-provider";

const MOVIQUOTES_API_BASE = "https://moviequotes.rocks/api/v1";
const MOVIQUOTES_PROVIDER_SLUG = "moviequotes";
/** Cap pages so we do not hammer the upstream API (20 quotes per page). */
const MOVIQUOTES_MAX_PAGES = 5;

export type MovieQuotesRocksRow = {
	id?: number;
	content?: string;
	year?: number;
	character?: { name?: string };
	movie?: { title?: string; slug?: string };
};

/** Map one upstream row into our normalized import shape. */
export function normalizeMovieQuotesRocksRow(
	row: MovieQuotesRocksRow,
	expectedYear: number | null,
): NormalizedQuote | null {
	const body = row.content?.trim();
	if (!body) return null;
	if (expectedYear != null && row.year != null && row.year !== expectedYear) {
		return null;
	}
	const externalId =
		row.id != null ? String(row.id) : `content:${body.slice(0, 64)}`;
	return {
		externalId,
		body,
		speaker: row.character?.name?.trim() || undefined,
	};
}

async function fetchMovieQuotesPage(args: {
	apiKey: string;
	movieSlug: string;
	page: number;
}): Promise<MovieQuotesRocksRow[]> {
	const url = new URL(`${MOVIQUOTES_API_BASE}/quotes`);
	url.searchParams.set("movie", args.movieSlug);
	url.searchParams.set("page", String(args.page));

	const res = await fetch(url, {
		headers: {
			Authorization: `Token token=${args.apiKey}`,
			Accept: "application/json",
		},
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(
			`MovieQuotes API ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
		);
	}
	const data: unknown = await res.json();
	if (!Array.isArray(data)) return [];
	return data as MovieQuotesRocksRow[];
}

/** Fetch all pages for a TMDb film using the cached title → slug mapping. */
export async function fetchMovieQuotesFromMovieQuotesRocks(
	tmdbMovieId: number,
): Promise<NormalizedQuote[]> {
	const apiKey = env.MOVIQUOTES_API_KEY?.trim();
	if (!apiKey) {
		throw new Error("MOVIQUOTES_API_KEY is not configured");
	}

	const [row] = await db
		.select({ title: movie.title, year: movie.year })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbMovieId))
		.limit(1);
	if (!row?.title) return [];

	const movieSlug = titleToMovieQuotesSlug(row.title);
	const quotes: NormalizedQuote[] = [];

	for (let page = 1; page <= MOVIQUOTES_MAX_PAGES; page += 1) {
		const pageRows = await fetchMovieQuotesPage({
			apiKey,
			movieSlug,
			page,
		});
		if (pageRows.length === 0) break;

		for (const raw of pageRows) {
			const normalized = normalizeMovieQuotesRocksRow(raw, row.year);
			if (normalized) quotes.push(normalized);
		}

		if (pageRows.length < 20) break;
	}

	return quotes;
}

/** Live provider registered when `QUOTE_API_PROVIDER=moviequotes`. */
export function createMovieQuotesProvider(): QuoteProvider {
	return {
		fetchMovieQuotes: fetchMovieQuotesFromMovieQuotesRocks,
	};
}

export { MOVIQUOTES_PROVIDER_SLUG };
