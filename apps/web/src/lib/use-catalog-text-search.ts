"use client";

import { useEffect, useState } from "react";

import { fetchMoviesSearch, fetchTvSearch } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

/** Which catalogue TMDb text search hits (movie vs TV). */
export type CatalogTextSearchListingKind = "movie" | "tv";

/** Normalized row from `/api/movies/search` or `/api/tv/search` (server maps TV `name` → `title`). */
export type CatalogTextSearchHit = {
	id: number;
	title: string;
	poster_url: string | null;
	release_date?: string;
	first_air_date?: string;
};

/**
 * Debounced TMDb title search against Still’s proxies — either movies or TV only,
 * so the home search dialog can respect a Films vs TV filter.
 */
export function useCatalogTextSearch(
	query: string,
	listingKind: CatalogTextSearchListingKind,
	debounceMs = 240,
) {
	const [results, setResults] = useState<CatalogTextSearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [setupHint, setSetupHint] = useState<string | null>(null);

	useEffect(() => {
		const q = query.trim();
		if (!q) {
			setResults([]);
			setSetupHint(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res =
					listingKind === "tv"
						? await fetchTvSearch(q, { signal: ctrl.signal })
						: await fetchMoviesSearch(q, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.error) {
					setResults([]);
					setSetupHint(null);
					return;
				}
				const data = res.data as { results?: CatalogTextSearchHit[] } | null;
				setSetupHint(tmdbSetupHint(data));
				setResults((data?.results ?? []) as CatalogTextSearchHit[]);
			} catch {
				if (!ctrl.signal.aborted) {
					setResults([]);
					setSetupHint(null);
				}
			} finally {
				if (!ctrl.signal.aborted) {
					setLoading(false);
				}
			}
		}, debounceMs);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query, listingKind, debounceMs]);

	return { results, loading, setupHint };
}
