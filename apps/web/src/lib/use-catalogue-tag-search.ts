"use client";

import { useEffect, useMemo, useState } from "react";

import { type ListBoardRow, toListBoardRow } from "@/lib/list-board-row";
import {
	deriveCatalogueFilterBundle,
	type SearchTag,
} from "@/lib/search-query-tags";
import {
	fetchListsSearch,
	fetchMoviesDiscover,
	fetchMoviesSearch,
	fetchTvDiscover,
	fetchTvSearch,
} from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";
import type { CatalogTextSearchHit } from "@/lib/use-catalog-text-search";

type TmdbSheetRow = {
	id: number;
	title?: string;
	poster_url?: string | null;
	release_date?: string;
	first_air_date?: string;
};

function mapCatalogueRows(rows: TmdbSheetRow[]): CatalogTextSearchHit[] {
	return rows.map((row) => ({
		id: row.id,
		title: row.title ?? "Untitled",
		poster_url: row.poster_url ?? null,
		release_date: row.release_date,
		first_air_date: row.first_air_date,
	}));
}

/**
 * Debounced catalogue + list search for the home dialog when filter tags are committed —
 * studios, genres, curated shortcuts, media kind, or lists mode.
 */
export function useCatalogueTagSearch(
	tags: SearchTag[],
	freeText: string,
	enabled: boolean,
	debounceMs = 240,
) {
	const [catalogueResults, setCatalogueResults] = useState<
		CatalogTextSearchHit[]
	>([]);
	const [listResults, setListResults] = useState<ListBoardRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [setupHint, setSetupHint] = useState<string | null>(null);
	const [needsSignIn, setNeedsSignIn] = useState(false);

	const active = enabled && tags.length > 0;
	const bundle = useMemo(() => deriveCatalogueFilterBundle(tags), [tags]);
	const { studioId, listingKind, resultMode, genreIds, keywordIds } = bundle;
	const q = freeText.trim();
	// Stable primitives for effect deps — bundle arrays are new references each render.
	const genreIdsKey = genreIds.join(",");
	const keywordIdsKey = keywordIds.join(",");
	const hasDiscoverFilters =
		studioId != null || genreIdsKey.length > 0 || keywordIdsKey.length > 0;

	useEffect(() => {
		if (!active) {
			setCatalogueResults([]);
			setListResults([]);
			setSetupHint(null);
			setNeedsSignIn(false);
			setLoading(false);
			return;
		}

		setLoading(true);
		const ctrl = new AbortController();

		const timer = setTimeout(async () => {
			try {
				if (resultMode === "lists") {
					const res = await fetchListsSearch(q, { signal: ctrl.signal });
					if (ctrl.signal.aborted) return;
					if (res.response.status === 401) {
						setListResults([]);
						setCatalogueResults([]);
						setNeedsSignIn(true);
						setSetupHint(null);
						return;
					}
					setNeedsSignIn(false);
					if (res.error) {
						setListResults([]);
						return;
					}
					const rows = Array.isArray(res.data)
						? res.data.map((row) => toListBoardRow(row))
						: [];
					setListResults(rows);
					setCatalogueResults([]);
					setSetupHint(null);
					return;
				}

				setNeedsSignIn(false);
				setListResults([]);

				if (!q && hasDiscoverFilters) {
					const discoverOpts = {
						signal: ctrl.signal,
						companyId: studioId ?? undefined,
						genreIds: genreIds.length > 0 ? genreIds : undefined,
						keywordIds: keywordIds.length > 0 ? keywordIds : undefined,
						sortBy: "popularity.desc",
					};
					const res =
						listingKind === "tv"
							? await fetchTvDiscover(1, discoverOpts)
							: await fetchMoviesDiscover(1, discoverOpts);
					if (ctrl.signal.aborted) return;
					const payload = res.data as { results?: TmdbSheetRow[] } | null;
					setSetupHint(tmdbSetupHint(payload));
					setCatalogueResults(mapCatalogueRows(payload?.results ?? []));
					return;
				}

				if (!q) {
					setCatalogueResults([]);
					setSetupHint(null);
					return;
				}

				const res =
					listingKind === "tv"
						? await fetchTvSearch(q, {
								signal: ctrl.signal,
								companyId: studioId ?? undefined,
							})
						: await fetchMoviesSearch(q, {
								signal: ctrl.signal,
								companyId: studioId ?? undefined,
							});

				if (ctrl.signal.aborted) return;
				if (res.error) {
					setCatalogueResults([]);
					setSetupHint(null);
					return;
				}

				const payload = res.data as { results?: TmdbSheetRow[] } | null;
				setSetupHint(tmdbSetupHint(payload));
				setCatalogueResults(mapCatalogueRows(payload?.results ?? []));
			} catch {
				if (!ctrl.signal.aborted) {
					setCatalogueResults([]);
					setListResults([]);
					setSetupHint(null);
				}
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, debounceMs);

		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [
		active,
		q,
		studioId,
		listingKind,
		resultMode,
		genreIds,
		keywordIds,
		hasDiscoverFilters,
		debounceMs,
	]);

	return {
		active,
		resultMode,
		catalogueResults,
		listResults,
		loading,
		setupHint,
		needsSignIn,
	};
}
