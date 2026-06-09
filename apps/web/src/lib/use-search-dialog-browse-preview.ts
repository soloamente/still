"use client";

import { useEffect, useState } from "react";

import {
	fetchMoviesDiscover,
	fetchMoviesPopular,
	fetchTvDiscover,
	fetchTvPopular,
} from "@/lib/still-api-fetch";

/** Left-rail categories in the empty search dialog. */
export type SearchDialogBrowseCategory = "movies" | "tv" | "people";

/** One poster tile in the browse preview column. */
export type SearchDialogBrowsePreviewItem = {
	id: number;
	title: string;
	posterUrl: string | null;
	listingKind: "movie" | "tv";
};

const PREVIEW_LIMIT = 4;
const STUDIO_PREVIEW_LIMIT = 8;

type TmdbSheetRow = {
	id: number;
	title?: string;
	poster_url?: string | null;
};

function previewItemKey(item: SearchDialogBrowsePreviewItem): string {
	return `${item.listingKind}-${item.id}`;
}

/** TMDb rows can repeat the same title — keep first occurrence only. */
function dedupeBrowsePreviewItems(
	items: SearchDialogBrowsePreviewItem[],
	limit = PREVIEW_LIMIT,
): SearchDialogBrowsePreviewItem[] {
	const seen = new Set<string>();
	const out: SearchDialogBrowsePreviewItem[] = [];
	for (const item of items) {
		const key = previewItemKey(item);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
		if (out.length >= limit) break;
	}
	return out;
}

function mapTmdbSheetRows(
	rows: TmdbSheetRow[],
	listingKind: "movie" | "tv",
	limit = PREVIEW_LIMIT,
): SearchDialogBrowsePreviewItem[] {
	return dedupeBrowsePreviewItems(
		rows.map((row) => ({
			id: row.id,
			title: row.title ?? "Untitled",
			posterUrl: row.poster_url ?? null,
			listingKind,
		})),
		limit,
	);
}

async function fetchBrowsePreview(
	category: SearchDialogBrowseCategory,
	studioCompanyId: number | null,
	signal: AbortSignal,
): Promise<SearchDialogBrowsePreviewItem[]> {
	switch (category) {
		case "movies": {
			if (studioCompanyId != null) {
				const res = await fetchMoviesDiscover(1, {
					signal,
					companyId: studioCompanyId,
					sortBy: "popularity.desc",
				});
				if (res.error || signal.aborted) return [];
				const payload = res.data as { results?: TmdbSheetRow[] } | null;
				return mapTmdbSheetRows(
					payload?.results ?? [],
					"movie",
					STUDIO_PREVIEW_LIMIT,
				);
			}
			const res = await fetchMoviesPopular(1, { signal });
			if (res.error || signal.aborted) return [];
			const payload = res.data as { results?: TmdbSheetRow[] } | null;
			return mapTmdbSheetRows(payload?.results ?? [], "movie");
		}
		case "tv": {
			if (studioCompanyId != null) {
				const res = await fetchTvDiscover(1, {
					signal,
					companyId: studioCompanyId,
					sortBy: "popularity.desc",
				});
				if (res.error || signal.aborted) return [];
				const payload = res.data as { results?: TmdbSheetRow[] } | null;
				return mapTmdbSheetRows(
					payload?.results ?? [],
					"tv",
					STUDIO_PREVIEW_LIMIT,
				);
			}
			const res = await fetchTvPopular(1, { signal });
			if (res.error || signal.aborted) return [];
			const payload = res.data as { results?: TmdbSheetRow[] } | null;
			return mapTmdbSheetRows(payload?.results ?? [], "tv");
		}
		case "people":
			return [];
		default: {
			const _exhaustive: never = category;
			return _exhaustive;
		}
	}
}

/**
 * Loads up to four suggested posters for the empty search dialog’s browse column.
 */
export function useSearchDialogBrowsePreview(
	category: SearchDialogBrowseCategory,
	studioCompanyId: number | null,
	enabled: boolean,
) {
	const [items, setItems] = useState<SearchDialogBrowsePreviewItem[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setItems([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const companyId =
			category === "movies" || category === "tv" ? studioCompanyId : null;
		void fetchBrowsePreview(category, companyId, ctrl.signal)
			.then((next) => {
				if (!ctrl.signal.aborted) setItems(next);
			})
			.catch(() => {
				if (!ctrl.signal.aborted) setItems([]);
			})
			.finally(() => {
				if (!ctrl.signal.aborted) setLoading(false);
			});
		return () => ctrl.abort();
	}, [category, studioCompanyId, enabled]);

	return { items, loading };
}
