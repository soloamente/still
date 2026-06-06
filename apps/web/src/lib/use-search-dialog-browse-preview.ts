"use client";

import { env } from "@still/env/web";
import { useEffect, useState } from "react";

import {
	fetchMoviesDiscover,
	fetchMoviesPopular,
	fetchTvDiscover,
	fetchTvPopular,
} from "@/lib/still-api-fetch";

/** Left-rail categories in the empty search dialog. */
export type SearchDialogBrowseCategory =
	| "movies"
	| "tv"
	| "community"
	| "people";

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

function posterUrlFromDbPath(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	return `https://image.tmdb.org/t/p/w342${path}`;
}

function previewItemKey(item: SearchDialogBrowsePreviewItem): string {
	return `${item.listingKind}-${item.id}`;
}

/** Popular reviews/lists can repeat the same title — keep first occurrence only. */
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

function parseReviewPopularRows(
	data: unknown,
): SearchDialogBrowsePreviewItem[] {
	if (!Array.isArray(data)) return [];
	const items: SearchDialogBrowsePreviewItem[] = [];
	const seenIds = new Set<number>();
	for (const row of data) {
		if (!row || typeof row !== "object") continue;
		const movie = (row as { movie?: Record<string, unknown> }).movie;
		if (!movie || typeof movie !== "object") continue;
		const id = Number(movie.tmdbId);
		if (!Number.isFinite(id) || seenIds.has(id)) continue;
		seenIds.add(id);
		items.push({
			id,
			title: String(movie.title ?? "Untitled"),
			posterUrl: posterUrlFromDbPath(
				typeof movie.posterPath === "string" ? movie.posterPath : null,
			),
			listingKind: "movie",
		});
		if (items.length >= PREVIEW_LIMIT) break;
	}
	return items;
}

function parseListPopularRows(data: unknown): SearchDialogBrowsePreviewItem[] {
	if (!Array.isArray(data)) return [];
	const items: SearchDialogBrowsePreviewItem[] = [];
	const seenIds = new Set<number>();
	for (const row of data) {
		if (!row || typeof row !== "object") continue;
		const r = row as Record<string, unknown>;
		const coverMovieIds = Array.isArray(r.coverMovieIds)
			? (r.coverMovieIds as number[])
			: [];
		const coverPosterPaths = Array.isArray(r.coverPosterPaths)
			? (r.coverPosterPaths as (string | null)[])
			: [];
		const movieId = coverMovieIds[0];
		if (
			movieId === undefined ||
			!Number.isFinite(movieId) ||
			seenIds.has(movieId)
		) {
			continue;
		}
		seenIds.add(movieId);
		const rawPoster = coverPosterPaths[0] ?? null;
		items.push({
			id: movieId,
			title: String(r.title ?? "List"),
			posterUrl: posterUrlFromDbPath(
				typeof rawPoster === "string" ? rawPoster : null,
			),
			listingKind: "movie",
		});
		if (items.length >= PREVIEW_LIMIT) break;
	}
	return items;
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
		case "community": {
			const reviewsUrl = new URL(
				"/api/reviews/popular",
				env.NEXT_PUBLIC_SERVER_URL,
			);
			reviewsUrl.searchParams.set("limit", String(PREVIEW_LIMIT));
			const reviewsRes = await fetch(reviewsUrl, {
				credentials: "include",
				signal,
			});
			if (reviewsRes.ok) {
				const reviewData = (await reviewsRes.json()) as unknown;
				const fromReviews = parseReviewPopularRows(reviewData);
				if (fromReviews.length > 0) return fromReviews;
			}
			if (signal.aborted) return [];
			const listsUrl = new URL(
				"/api/lists/popular",
				env.NEXT_PUBLIC_SERVER_URL,
			);
			listsUrl.searchParams.set("limit", String(PREVIEW_LIMIT));
			const listsRes = await fetch(listsUrl, {
				credentials: "include",
				signal,
			});
			if (!listsRes.ok || signal.aborted) return [];
			const listData = (await listsRes.json()) as unknown;
			return parseListPopularRows(listData);
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
