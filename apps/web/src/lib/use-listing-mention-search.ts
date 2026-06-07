"use client";

import { useEffect, useState } from "react";
import { fetchMoviesSearch, fetchTvSearch } from "@/lib/still-api-fetch";
import type { CatalogTextSearchHit } from "@/lib/use-catalog-text-search";

export type ListingMentionSearchHit = CatalogTextSearchHit & {
	listingKind: "movie" | "tv";
};

/** Debounced film + TV search for `@` tags in review copy. */
export function useListingMentionSearch(query: string, debounceMs = 220) {
	const [results, setResults] = useState<ListingMentionSearchHit[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const q = query.trim();
		if (!q) {
			setResults([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const [moviesRes, tvRes] = await Promise.all([
					fetchMoviesSearch(q, { signal: ctrl.signal }),
					fetchTvSearch(q, { signal: ctrl.signal }),
				]);
				if (ctrl.signal.aborted) return;

				const movieRows = (
					(moviesRes.data as { results?: CatalogTextSearchHit[] } | null)
						?.results ?? []
				).slice(0, 5);
				const tvRows = (
					(tvRes.data as { results?: CatalogTextSearchHit[] } | null)
						?.results ?? []
				).slice(0, 5);

				setResults([
					...movieRows.map(
						(row): ListingMentionSearchHit => ({
							...row,
							listingKind: "movie",
						}),
					),
					...tvRows.map(
						(row): ListingMentionSearchHit => ({
							...row,
							listingKind: "tv",
						}),
					),
				]);
			} catch {
				if (!ctrl.signal.aborted) setResults([]);
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, debounceMs);

		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query, debounceMs]);

	return { results, loading };
}
