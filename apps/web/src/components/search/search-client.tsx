"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";

import { MoviePoster } from "@/components/movie/movie-poster";
import {
	FilterChipButton,
	FilterChipRow,
} from "@/components/ui/filter-chip-row";
import { SearchPillField } from "@/components/ui/search-pill-field";
import { Section } from "@/components/ui/section";
import { fetchMoviesSearch } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

type Movie = {
	id: number;
	title: string;
	poster_url: string | null;
	release_date?: string;
};

/**
 * Full-page search. The palette covers ⌘K but a dedicated page is
 * still useful for browsing big result lists and bookmarking queries.
 */
export function SearchClient({
	searchParamsPromise,
}: {
	searchParamsPromise: Promise<{ q?: string }>;
}) {
	const initialQuery = use(searchParamsPromise).q ?? "";
	const router = useRouter();
	const params = useSearchParams();
	const [query, setQuery] = useState(initialQuery);
	const [results, setResults] = useState<Movie[]>([]);
	const [loading, setLoading] = useState(false);
	const [setupHint, setSetupHint] = useState<string | null>(null);

	useEffect(() => {
		const q = query.trim();
		if (!q) {
			setResults([]);
			setSetupHint(null);
			// If the user clears the box before the debounce fires, we never enter the async path
			// but a previous effect may have set loading — avoid a stuck "Searching…" bar.
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchMoviesSearch(q, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.error) {
					setResults([]);
					setSetupHint(null);
					return;
				}
				const data = res.data as { results?: Movie[] } | null;
				setSetupHint(tmdbSetupHint(data));
				setResults((data?.results ?? []) as Movie[]);
			} catch {
				if (!ctrl.signal.aborted) {
					setResults([]);
					setSetupHint(null);
				}
			} finally {
				setLoading(false);
			}
		}, 240);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query]);

	// Mirror to URL so the search is shareable.
	useEffect(() => {
		const trimmed = query.trim();
		const existing = params.get("q") ?? "";
		if (existing === trimmed) return;
		const search = trimmed ? `?q=${encodeURIComponent(trimmed)}` : "";
		router.replace(`/search${search}`, { scroll: false });
	}, [query, params, router]);

	const trimmedQuery = query.trim();

	return (
		<Section
			title="Search"
			subtitle="Find a film, a director, an actor, or anyone on Still."
		>
			{/* Track B: pill field + scope chip — same family as Mobbin / Cosmos search shells. */}
			<SearchPillField
				type="search"
				autoFocus
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="The Shining, Hayao Miyazaki, @yourfriend…"
				spellCheck={false}
				scopeLabel="Films"
				showClearQuery={false}
			/>
			{/* Dismissible “applied query” chip — mirrors advanced filter chips on browse pages. */}
			{trimmedQuery ? (
				<FilterChipRow className="mt-3" aria-label="Active search filters">
					<FilterChipButton
						type="button"
						onClick={() => setQuery("")}
						aria-label={`Clear search: ${trimmedQuery}`}
					>
						<span className="max-w-[min(90vw,20rem)] truncate">
							Query · “{trimmedQuery}”
						</span>
					</FilterChipButton>
				</FilterChipRow>
			) : null}
			{loading ? (
				<p className="text-muted-foreground text-xs">Searching…</p>
			) : null}
			<div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
				{results.map((m) => (
					<MoviePoster
						key={m.id}
						movieId={m.id}
						title={m.title}
						posterUrl={m.poster_url}
						showTitle
					/>
				))}
			</div>
			{!loading && trimmedQuery && results.length === 0 ? (
				<p className="text-center text-muted-foreground text-sm">
					{setupHint ?? <>No films found for &ldquo;{trimmedQuery}&rdquo;.</>}
				</p>
			) : null}
		</Section>
	);
}
