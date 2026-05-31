"use client";

import { useEffect, useMemo, useState } from "react";

import { planCatalogueTagSearch } from "@/lib/catalogue-tag-search-plan";
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
import type {
	CatalogTextSearchHit,
	CatalogTextSearchListingKind,
} from "@/lib/use-catalog-text-search";

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
	listingKindOverride: CatalogTextSearchListingKind,
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
	const bundle = useMemo(
		() => deriveCatalogueFilterBundle(tags, listingKindOverride),
		[tags, listingKindOverride],
	);
	const { studioId, listingKind, resultMode, genreIds, keywordIds } = bundle;
	const q = freeText.trim();
	// Stable primitives for effect deps — bundle arrays are new references each render.
	const genreIdsKey = genreIds.join(",");
	const keywordIdsKey = keywordIds.join(",");

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

				const plan = planCatalogueTagSearch({
					q,
					listingKind,
					studioId,
					genreIds,
					keywordIds,
				});

				if (plan.mode === "discover") {
					const discoverOpts = {
						signal: ctrl.signal,
						...plan.opts,
					};
					const res =
						plan.listingKind === "tv"
							? await fetchTvDiscover(1, discoverOpts)
							: await fetchMoviesDiscover(1, discoverOpts);
					if (ctrl.signal.aborted) return;
					const payload = res.data as { results?: TmdbSheetRow[] } | null;
					setSetupHint(tmdbSetupHint(payload));
					setCatalogueResults(mapCatalogueRows(payload?.results ?? []));
					return;
				}

				if (plan.mode === "none") {
					setCatalogueResults([]);
					setSetupHint(null);
					return;
				}

				const res =
					plan.listingKind === "tv"
						? await fetchTvSearch(plan.q, {
								signal: ctrl.signal,
								companyId: plan.companyId,
							})
						: await fetchMoviesSearch(plan.q, {
								signal: ctrl.signal,
								companyId: plan.companyId,
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
		listingKindOverride,
		resultMode,
		genreIdsKey,
		keywordIdsKey,
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
