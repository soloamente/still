import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import type { CatalogueTagSearchPlan } from "@/lib/catalogue-tag-search-plan";
import { planCatalogueTagSearch } from "@/lib/catalogue-tag-search-plan";
import { tvDiscoverSortByForLobbySort } from "@/lib/home-catalog-run";
import {
	type HomeCatalogueSearchLobbySort,
	parseHomeCatalogueSearchParam,
	serializeHomeCatalogueSearchParam,
} from "@/lib/home-catalogue-search-param";
import type { SearchDialogStudio } from "@/lib/search-dialog-studios";
import type { SearchDialogGenre } from "@/lib/search-query-tags";
import {
	deriveCatalogueFilterBundle,
	type SearchTag,
} from "@/lib/search-query-tags";
import {
	fetchMovieGenres,
	fetchMovieStudios,
	fetchMoviesDiscover,
	fetchMoviesSearch,
	fetchTvDiscover,
	fetchTvGenres,
	fetchTvSearch,
	isFetchAbortError,
} from "@/lib/still-api-fetch";

/** Raw row shape from TMDb search/discover proxies (server maps TV `name` → `title`). */
type CatalogueSearchApiRow = {
	id: number;
	title?: string;
	poster_url?: string | null;
};

/** Matches `PopularMoviesInfinite` `loadPage` success/error union. */
export type CatalogueSearchPageResult =
	| { results: PopularMovieSeed[]; total_pages: number }
	| { error: true };

/** Which upstream list API backs a committed catalogue search page. */
export type CatalogueSearchFetchTarget =
	| { kind: "discover"; listingKind: "movie" | "tv" }
	| { kind: "search"; listingKind: "movie" | "tv" }
	| { kind: "none" };

export function resolveCatalogueSearchFetchTarget(
	plan: CatalogueTagSearchPlan,
): CatalogueSearchFetchTarget {
	if (plan.mode === "none") return { kind: "none" };
	if (plan.mode === "discover") {
		return { kind: "discover", listingKind: plan.listingKind };
	}
	return { kind: "search", listingKind: plan.listingKind };
}

/** Maps committed-search sort chips to TMDb discover `sort_by`. */
export function catalogueDiscoverSortByForSearchLobby(
	sort: HomeCatalogueSearchLobbySort,
	listingKind: "movie" | "tv",
): string {
	if (listingKind === "tv") {
		return tvDiscoverSortByForLobbySort(sort);
	}
	return sort === "popular" ? "popularity.desc" : "primary_release_date.desc";
}

/** Builds the TMDb fetch plan for a committed `/home?search=` URL. */
export function buildCatalogueSearchPlanFromCommit(
	tags: SearchTag[],
	freeText: string,
	browse: "movies" | "tv",
	sort: HomeCatalogueSearchLobbySort = "popular",
): CatalogueTagSearchPlan {
	const listingKind = browse === "tv" ? "tv" : "movie";
	const bundle = deriveCatalogueFilterBundle(tags, listingKind);
	const basePlan = planCatalogueTagSearch({
		q: freeText.trim(),
		listingKind: bundle.listingKind,
		studioId: bundle.studioId,
		genreIds: bundle.genreIds,
		keywordIds: bundle.keywordIds,
	});
	const sortBy = catalogueDiscoverSortByForSearchLobby(sort, listingKind);

	if (basePlan.mode === "discover") {
		return {
			...basePlan,
			opts: { ...basePlan.opts, sortBy },
		};
	}

	if (basePlan.mode === "search" && basePlan.q.trim()) {
		// Plain text uses discover + `with_text_query` so Popular / Latest chips apply.
		return {
			mode: "discover",
			listingKind: basePlan.listingKind,
			opts: {
				companyId: basePlan.companyId,
				sortBy,
				q: basePlan.q,
			},
		};
	}

	return basePlan;
}

/** RSC + client grid: first page seeds for `/home?search=`. */
export type CommittedCatalogueSearchSeedPayload = {
	searchWaveKey: string;
	seeds: PopularMovieSeed[];
	totalPages: number;
	error?: boolean;
};

/** Committed search needs studio/genre metadata to rebuild tag-only URLs (e.g. `A24`). */
export function committedCatalogueSearchNeedsTagMetadata(
	searchRaw: string,
): boolean {
	return Boolean(searchRaw.trim());
}

function normalizeGenresFromApi(payload: unknown): SearchDialogGenre[] {
	if (!payload || typeof payload !== "object") return [];
	const genres = (payload as { genres?: unknown }).genres;
	if (!Array.isArray(genres)) return [];
	return genres
		.map((row) => {
			if (!row || typeof row !== "object") return null;
			const id = Number((row as { id?: unknown }).id);
			const name = String((row as { name?: unknown }).name ?? "").trim();
			if (!Number.isFinite(id) || id <= 0 || !name) return null;
			return { id: Math.floor(id), name };
		})
		.filter((row): row is SearchDialogGenre => row !== null);
}

function normalizeStudiosFromApi(payload: unknown): SearchDialogStudio[] {
	if (!payload || typeof payload !== "object") return [];
	const studios = (payload as { studios?: unknown }).studios;
	if (!Array.isArray(studios)) return [];
	return studios
		.map((row) => {
			if (!row || typeof row !== "object") return null;
			const id = Number((row as { id?: unknown }).id);
			const name = String((row as { name?: unknown }).name ?? "").trim();
			if (!Number.isFinite(id) || id <= 0 || !name) return null;
			return {
				id: Math.floor(id),
				name,
				logoUrl:
					typeof (row as { logo_url?: unknown }).logo_url === "string"
						? (row as { logo_url: string }).logo_url
						: null,
			};
		})
		.filter((row): row is SearchDialogStudio => row !== null);
}

/**
 * Server path for committed search — page 1 only (scroll loads 2…N on the client).
 * Plain-text queries skip studio/genre metadata fetches.
 */
export async function loadCommittedCatalogueSearchSeeds(input: {
	searchRaw: string;
	browse: "movies" | "tv";
	sort?: HomeCatalogueSearchLobbySort;
	cookieHeader?: string;
	catalogLanguage?: string;
}): Promise<CommittedCatalogueSearchSeedPayload> {
	const searchRaw = input.searchRaw.trim();
	const browse = input.browse;
	const sort = input.sort ?? "popular";
	const lang = input.catalogLanguage?.trim() || "en-US";
	const fetchInit = { cookieHeader: input.cookieHeader };

	let studios: SearchDialogStudio[] = [];
	let movieGenres: SearchDialogGenre[] = [];
	let tvGenres: SearchDialogGenre[] = [];

	if (committedCatalogueSearchNeedsTagMetadata(searchRaw)) {
		const [studioRes, movieGenreRes, tvGenreRes] = await Promise.all([
			fetchMovieStudios(fetchInit),
			fetchMovieGenres({ ...fetchInit, language: lang }),
			fetchTvGenres({ ...fetchInit, language: lang }),
		]);
		studios = normalizeStudiosFromApi(studioRes.data);
		movieGenres = normalizeGenresFromApi(movieGenreRes.data);
		tvGenres = normalizeGenresFromApi(tvGenreRes.data);
	}

	const parsed = parseHomeCatalogueSearchParam(searchRaw, studios, {
		movieGenres,
		tvGenres,
	});
	const plan = buildCatalogueSearchPlanFromCommit(
		parsed.tags,
		parsed.freeText,
		browse,
		sort,
	);
	const searchWaveKey = `${browse}:${sort}:${serializeHomeCatalogueSearchParam(parsed.tags, parsed.freeText)}`;

	const page = await loadCatalogueSearchPage(plan, 1, fetchInit);
	if ("error" in page) {
		return { searchWaveKey, seeds: [], totalPages: 0, error: true };
	}
	return {
		searchWaveKey,
		seeds: page.results,
		totalPages: page.total_pages,
	};
}

/** Maps TMDb proxy rows into lobby poster seeds (mixed movie/TV grid uses `listingKind`). */
export function mapCatalogueSearchRowsToSeeds(
	rows: CatalogueSearchApiRow[],
	listingKind: "movie" | "tv",
): PopularMovieSeed[] {
	return rows.map((row) => ({
		id: row.id,
		title: row.title ?? "Untitled",
		poster_url: row.poster_url ?? null,
		listingKind,
	}));
}

/** Normalizes paged API JSON into infinite-grid payload. */
export function parseCatalogueSearchPagePayload(
	data: unknown,
	listingKind: "movie" | "tv",
): CatalogueSearchPageResult | null {
	if (!data || typeof data !== "object") return null;
	const payload = data as {
		results?: CatalogueSearchApiRow[];
		total_pages?: number;
	};
	const rows = Array.isArray(payload.results) ? payload.results : [];
	const totalPages =
		typeof payload.total_pages === "number" && payload.total_pages > 0
			? payload.total_pages
			: rows.length > 0
				? 1
				: 0;
	return {
		results: mapCatalogueSearchRowsToSeeds(rows, listingKind),
		total_pages: totalPages,
	};
}

/**
 * Loads one page of committed `/home?search=` results — discover (strict AND) or text search.
 * Shared by the lobby search grid and future callers; mirrors `useCatalogueTagSearch` fetch paths.
 */
export async function loadCatalogueSearchPage(
	plan: CatalogueTagSearchPlan,
	page: number,
	init?: Pick<RequestInit, "signal"> & { cookieHeader?: string },
): Promise<CatalogueSearchPageResult> {
	const target = resolveCatalogueSearchFetchTarget(plan);
	if (target.kind === "none") {
		return { results: [], total_pages: 0 };
	}

	const safePage = Math.max(1, Math.floor(page) || 1);
	const { signal, cookieHeader } = init ?? {};

	try {
		if (target.kind === "discover" && plan.mode === "discover") {
			const discoverInit = { signal, cookieHeader, ...plan.opts };
			const res =
				plan.listingKind === "tv"
					? await fetchTvDiscover(safePage, discoverInit)
					: await fetchMoviesDiscover(safePage, discoverInit);
			if (res.error || res.data == null) return { error: true };
			return (
				parseCatalogueSearchPagePayload(res.data, plan.listingKind) ?? {
					error: true,
				}
			);
		}

		if (plan.mode !== "search") {
			return { error: true };
		}

		const res =
			plan.listingKind === "tv"
				? await fetchTvSearch(plan.q, {
						signal,
						cookieHeader,
						page: safePage,
						companyId: plan.companyId,
					})
				: await fetchMoviesSearch(plan.q, {
						signal,
						cookieHeader,
						page: safePage,
						companyId: plan.companyId,
					});
		if (res.error || res.data == null) return { error: true };
		return (
			parseCatalogueSearchPagePayload(res.data, plan.listingKind) ?? {
				error: true,
			}
		);
	} catch (error) {
		// Effect cleanup aborts page-1 fetches when `?search=` changes — not a real failure.
		if (isFetchAbortError(error, signal ?? undefined)) {
			throw error;
		}
		return { error: true };
	}
}
