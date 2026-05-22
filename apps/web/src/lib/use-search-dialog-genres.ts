"use client";

import { useEffect, useState } from "react";

import type { SearchDialogGenre } from "@/lib/search-query-tags";
import { fetchMovieGenres, fetchTvGenres } from "@/lib/still-api-fetch";

type GenreCacheEntry = {
	movie: SearchDialogGenre[];
	tv: SearchDialogGenre[];
};

const genreCacheByLanguage = new Map<string, GenreCacheEntry>();

/** Clear after catalogue language changes in Settings. */
export function clearSearchDialogGenreCache() {
	genreCacheByLanguage.clear();
}

function normalizeGenres(payload: unknown): SearchDialogGenre[] {
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

/** Movie + TV genre lists for search dialog tag autocomplete (patron catalogue language). */
export function useSearchDialogGenres(enabled: boolean, language: string) {
	const langKey = language.trim() || "en-US";
	const cached = genreCacheByLanguage.get(langKey);

	const [movieGenres, setMovieGenres] = useState<SearchDialogGenre[]>(
		() => cached?.movie ?? [],
	);
	const [tvGenres, setTvGenres] = useState<SearchDialogGenre[]>(
		() => cached?.tv ?? [],
	);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setLoading(false);
			return;
		}

		const hit = genreCacheByLanguage.get(langKey);
		if (hit) {
			setMovieGenres(hit.movie);
			setTvGenres(hit.tv);
			setLoading(false);
			return;
		}

		const ctrl = new AbortController();
		setLoading(true);

		void (async () => {
			try {
				const fetchOpts = {
					signal: ctrl.signal,
					language: langKey,
				};
				const [movieRes, tvRes] = await Promise.all([
					fetchMovieGenres(fetchOpts),
					fetchTvGenres(fetchOpts),
				]);
				if (ctrl.signal.aborted) return;
				const movie = normalizeGenres(movieRes.data);
				const tv = normalizeGenres(tvRes.data);
				genreCacheByLanguage.set(langKey, { movie, tv });
				setMovieGenres(movie);
				setTvGenres(tv);
			} catch {
				if (!ctrl.signal.aborted) {
					setMovieGenres([]);
					setTvGenres([]);
				}
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		})();

		return () => ctrl.abort();
	}, [enabled, langKey]);

	return { movieGenres, tvGenres, loading };
}

/** Deduped union for Tab autocomplete — prefers the active catalogue kind when populated. */
export function mergeSearchDialogGenres(
	listingKind: "movie" | "tv",
	movieGenres: SearchDialogGenre[],
	tvGenres: SearchDialogGenre[],
	language = "en-US",
): SearchDialogGenre[] {
	const primary = listingKind === "tv" ? tvGenres : movieGenres;
	const secondary = listingKind === "tv" ? movieGenres : tvGenres;
	const source = primary.length > 0 ? primary : secondary;
	const fallback = source.length > 0 ? source : [...movieGenres, ...tvGenres];
	const seen = new Set<number>();
	const out: SearchDialogGenre[] = [];
	for (const g of fallback) {
		if (seen.has(g.id)) continue;
		seen.add(g.id);
		out.push(g);
	}
	return out.sort((a, b) => a.name.localeCompare(b.name, language));
}
