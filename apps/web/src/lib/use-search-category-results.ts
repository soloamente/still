"use client";

import type { SearchCategory } from "@/lib/search-active-category";
import { useCastCrewSearch } from "@/lib/use-cast-crew-search";
import { useCatalogTextSearch } from "@/lib/use-catalog-text-search";
import { useListsTextSearch } from "@/lib/use-lists-text-search";
import { useProfileSearch } from "@/lib/use-profile-search";

export type CategoryCount = { count: number; loading: boolean };

/**
 * Runs all enabled category searches in parallel for a plain free-text query.
 * Films/TV/Cast&Crew (TMDb proxy) fire at >=1 char; Lists/Members (Neon) only
 * when signed in and >=2 chars, to limit DB load. Returns per-category counts
 * plus the raw hook results for rendering.
 */
export function useSearchCategoryResults(query: string, signedIn: boolean) {
	const trimmed = query.trim();
	const dbEligible = signedIn && trimmed.length >= 2;

	const films = useCatalogTextSearch(query, "movie");
	const tv = useCatalogTextSearch(query, "tv");
	const castcrew = useCastCrewSearch(query, trimmed.length >= 1);
	const lists = useListsTextSearch(query, dbEligible);
	const members = useProfileSearch(query, dbEligible);

	const categories: Record<SearchCategory, CategoryCount> = {
		films: { count: films.results.length, loading: films.loading },
		tv: { count: tv.results.length, loading: tv.loading },
		castcrew: { count: castcrew.results.length, loading: castcrew.loading },
		lists: { count: lists.results.length, loading: lists.loading },
		members: { count: members.hits.length, loading: members.loading },
	};

	const anyLoading =
		films.loading ||
		tv.loading ||
		castcrew.loading ||
		lists.loading ||
		members.loading;

	const setupHint =
		films.setupHint ?? tv.setupHint ?? castcrew.setupHint ?? null;

	return {
		categories,
		anyLoading,
		setupHint,
		films,
		tv,
		castcrew,
		lists,
		members,
	};
}
