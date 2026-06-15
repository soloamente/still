import { env } from "@still/env/server";
import {
	createMoviefamousQuoteProvider,
	MOVIEFAMOUS_PROVIDER_SLUG,
} from "./moviefamous-quotes-provider";
import {
	createMovieQuotesProvider,
	MOVIQUOTES_PROVIDER_SLUG,
} from "./moviequotes-provider";

export type NormalizedQuote = {
	externalId: string;
	body: string;
	speaker?: string;
	timestampMs?: number;
	seasonNumber?: number;
	episodeNumber?: number;
};

export interface QuoteProvider {
	/** Fetch quotes for a TMDb movie id. */
	fetchMovieQuotes(tmdbMovieId: number): Promise<NormalizedQuote[]>;
	/** Optional — when provider supports TV episode granularity. */
	fetchTvEpisodeQuotes?(
		tmdbTvId: number,
		season: number,
		episode: number,
	): Promise<NormalizedQuote[]>;
}

/** No-op provider used in tests and when env is unset. */
export function stubQuoteProvider(): QuoteProvider {
	return {
		fetchMovieQuotes: async () => [],
		fetchTvEpisodeQuotes: async () => [],
	};
}

/** Resolve configured provider slug, or null when import should stay disabled. */
export function quoteProviderSlugFromEnv(): string | null {
	const raw = process.env.QUOTE_API_PROVIDER?.trim().toLowerCase();
	if (!raw || raw === "stub") return null;
	return raw;
}

/** Whether lazy import on empty catalog is enabled (`QUOTE_IMPORT_ENABLED=true`). */
export function isQuoteImportEnabled(): boolean {
	const raw = process.env.QUOTE_IMPORT_ENABLED?.trim().toLowerCase();
	return raw === "true" || raw === "1" || raw === "yes";
}

/** Live provider instance — extend switch when licensing additional partners. */
export function resolveQuoteProvider(): QuoteProvider | null {
	const slug = quoteProviderSlugFromEnv();
	if (!slug) return null;

	if (slug === MOVIQUOTES_PROVIDER_SLUG) {
		if (!env.MOVIQUOTES_API_KEY?.trim()) {
			console.warn(
				"[quote-provider] QUOTE_API_PROVIDER=moviequotes but MOVIQUOTES_API_KEY is unset",
			);
			return null;
		}
		return createMovieQuotesProvider();
	}

	if (slug === MOVIEFAMOUS_PROVIDER_SLUG) {
		return createMoviefamousQuoteProvider();
	}

	console.warn(`[quote-provider] Unknown QUOTE_API_PROVIDER="${slug}"`);
	return null;
}
