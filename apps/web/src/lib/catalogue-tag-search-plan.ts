/** Discover fetch options shared by movie and TV catalogue tag search. */
export type CatalogueTagDiscoverOpts = {
	companyId?: number;
	genreIds?: number[];
	keywordIds?: number[];
	sortBy: string;
	q?: string;
};

export type CatalogueTagSearchPlan =
	| {
			mode: "discover";
			listingKind: "movie" | "tv";
			opts: CatalogueTagDiscoverOpts;
	  }
	| {
			mode: "search";
			listingKind: "movie" | "tv";
			q: string;
			companyId?: number;
	  }
	| { mode: "none" };

/**
 * Decide whether structured ⌘K tag search should hit discover (strict AND) or legacy `/search`.
 * When genre, keyword, or studio filters exist, always prefer discover — including with free text.
 */
export function planCatalogueTagSearch(input: {
	q: string;
	listingKind: "movie" | "tv";
	studioId: number | null;
	genreIds: number[];
	keywordIds: number[];
}): CatalogueTagSearchPlan {
	const q = input.q.trim();
	const hasDiscoverFilters =
		input.studioId != null ||
		input.genreIds.length > 0 ||
		input.keywordIds.length > 0;

	if (hasDiscoverFilters) {
		return {
			mode: "discover",
			listingKind: input.listingKind,
			opts: {
				companyId: input.studioId ?? undefined,
				genreIds: input.genreIds.length > 0 ? input.genreIds : undefined,
				keywordIds: input.keywordIds.length > 0 ? input.keywordIds : undefined,
				sortBy: "popularity.desc",
				q: q || undefined,
			},
		};
	}

	if (!q) {
		return { mode: "none" };
	}

	return {
		mode: "search",
		listingKind: input.listingKind,
		q,
		companyId: input.studioId ?? undefined,
	};
}
