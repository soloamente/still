"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import {
	MoviePoster,
	type MoviePosterHoverEffect,
} from "@/components/movie/movie-poster";
import {
	fetchMoviesDiscover,
	fetchMoviesPopular,
	fetchMoviesUpcoming,
	fetchTvDiscover,
	fetchTvPopular,
} from "@/lib/still-api-fetch";

export type PopularMovieSeed = {
	id: number;
	title: string;
	poster_url: string | null;
};

export type TmdbCatalogKind = "popular" | "upcoming" | "discover";

interface PopularMoviesInfiniteProps {
	/** First TMDb page — server-rendered for fast paint. */
	seedMovies: PopularMovieSeed[];
	/** Always `1` today — kept for symmetry if we hydrate mid-catalogue later. */
	seedPage: number;
	totalPages: number;
	totalResults: number;
	/** TMDB unset / upstream failure — no further client fetches. */
	blockedReason: string | null;
	/** Which TMDb list to page through — defaults to “popular”. */
	catalogKind?: TmdbCatalogKind;
	/** Which medium the infinite list pages through — drives client fetches + poster links. */
	catalogMedia?: "movie" | "tv";
	/** Discover: optional TMDb genre id (`with_genres`). */
	discoverGenreId?: number | null;
	/** Discover: `sort_by` passthrough (server whitelist). */
	discoverSortBy?: string;
	/** Overrides grid classes — default matches full-width billboard pages. */
	gridClassName?: string;
	/** Merges onto each `MoviePoster` `<Link>` (e.g. `min-w-0` in dense grids). */
	posterLinkClassName?: string;
	/** Merges onto each poster frame (`rounded-*`, border tweaks, lobby chrome). */
	posterFrameClassName?: string;
	/** Lobby-style grids often hide titles; billboard keeps them on. */
	showTitle?: boolean;
	/** Replaces translate-hover with card-tinted elevation (e.g. home lobby grid). */
	posterHoverEffect?: MoviePosterHoverEffect;
	/**
	 * When `posterHoverEffect` is `elevation` and this is `true`, other tiles turn grayscale
	 * while one is hovered (mirrors profile `catalogMonochromePeersOnHover` on `/home`).
	 */
	monochromePeersOnHover?: boolean;
	/**
	 * Fade + stagger poster cells on mount, after catalogue resets (e.g. Latest ↔ Popular),
	 * and when infinite scroll appends rows (new indices pick up delay from capped index).
	 */
	staggerPosterEntrance?: boolean;
	/** Replaces the auto “popular / discover / upcoming” phrase in the exhausted caption. */
	catalogLabel?: string;
}

/** How far below the fold we start pulling the next sheet (pixels). Mirrors “feels infinite” pacing. */
const SCROLL_MARGIN_PX = 280;

export function PopularMoviesInfinite({
	seedMovies,
	seedPage,
	totalPages: initialTotalPages,
	totalResults,
	blockedReason,
	catalogKind = "popular",
	catalogMedia = "movie",
	discoverGenreId = null,
	discoverSortBy = "popularity.desc",
	gridClassName = "grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-5 md:grid-cols-5 md:gap-6 lg:grid-cols-6 lg:gap-7",
	posterLinkClassName,
	posterFrameClassName,
	showTitle = true,
	catalogLabel: catalogLabelProp,
	posterHoverEffect = "lift",
	monochromePeersOnHover = true,
	staggerPosterEntrance = false,
}: PopularMoviesInfiniteProps) {
	/** Single primitive for effect deps — mirrors `motion` remount keys below. */
	const catalogueWaveKey = `${catalogMedia}:${catalogKind}:${discoverSortBy}:${discoverGenreId ?? ""}`;

	const reduceMotion = useReducedMotion();
	const blockedRef = useRef(false);
	blockedRef.current = Boolean(blockedReason);

	const [items, setItems] = useState<PopularMovieSeed[]>(() => [...seedMovies]);

	/** Stale-safe mirror for async closure + post-fetch peek without resubscribing observers. */
	const nextPageRef = useRef(seedPage + 1);
	const totalPagesRef = useRef(initialTotalPages);
	totalPagesRef.current = initialTotalPages;

	const loadingRef = useRef(false);

	/** Footer UX only — observers use refs so we never miss a “still pinned” sentinel. */
	const [footerState, setFooterState] = useState<
		"idle" | "loading" | "exhausted" | "error"
	>(() => {
		if (blockedReason) return "exhausted";
		if (!initialTotalPages || seedPage >= initialTotalPages) return "exhausted";
		return "idle";
	});

	const sentinelRef = useRef<HTMLDivElement>(null);
	/** Let the IntersectionObserver call the latest loader without tearing the observer on each tick. */
	const loadMoreRef = useRef<() => Promise<void>>(async () => {});

	/**
	 * If the viewport is taller than two sheets of posters stacked, IntersectionObserver
	 * fires once — we chain with a geometry peek after each idle flush so backlog drains.
	 */
	const peekIfRoomForMore = useCallback(() => {
		if (typeof window === "undefined") return;
		if (blockedRef.current || loadingRef.current) return;

		const next = nextPageRef.current;
		const tp = totalPagesRef.current;
		if (tp > 0 && next > tp) return;

		const el = sentinelRef.current;
		if (!el) return;

		const r = el.getBoundingClientRect();
		if (r.top <= window.innerHeight + SCROLL_MARGIN_PX) {
			void loadMoreRef.current();
		}
	}, []);

	const loadMore = useCallback(async () => {
		if (blockedRef.current) return;

		const next = nextPageRef.current;
		const tp = totalPagesRef.current;

		/** Catalogue tail — TMDB publishes `total_pages`. */
		if (tp > 0 && next > tp) {
			setFooterState("exhausted");
			return;
		}

		if (loadingRef.current) return;

		loadingRef.current = true;
		setFooterState("loading");

		try {
			const isTv = catalogMedia === "tv";
			const { data, error } =
				catalogKind === "upcoming"
					? await fetchMoviesUpcoming(next)
					: catalogKind === "discover"
						? isTv
							? await fetchTvDiscover(next, {
									genreId: discoverGenreId ?? undefined,
									sortBy: discoverSortBy,
								})
							: await fetchMoviesDiscover(next, {
									genreId: discoverGenreId ?? undefined,
									sortBy: discoverSortBy,
								})
						: isTv
							? await fetchTvPopular(next)
							: await fetchMoviesPopular(next);

			loadingRef.current = false;

			if (error || !data || typeof data !== "object") {
				setFooterState("error");
				return;
			}

			const pageData = data as {
				results?: PopularMovieSeed[];
				total_pages?: number;
			};

			const batch = Array.isArray(pageData.results) ? pageData.results : [];

			if (
				typeof pageData.total_pages === "number" &&
				pageData.total_pages > 0
			) {
				totalPagesRef.current = pageData.total_pages;
			}

			/** Merge without duplicate keys across overlapping windows (defensive only). */
			setItems((prev) => {
				const seen = new Set(prev.map((m) => m.id));
				const out = [...prev];
				for (const row of batch) {
					if (!seen.has(row.id)) {
						seen.add(row.id);
						out.push(row);
					}
				}
				return out;
			});

			nextPageRef.current = next + 1;

			const effectiveTp = totalPagesRef.current;
			const depleted =
				batch.length === 0 ||
				(effectiveTp > 0 && nextPageRef.current > effectiveTp);

			setFooterState(depleted ? "exhausted" : "idle");

			/** Drain tall viewports until the sentinel scrolls below the chrome. */
			if (!depleted) {
				queueMicrotask(() => peekIfRoomForMore());
			}
		} catch {
			loadingRef.current = false;
			setFooterState("error");
		}
	}, [
		catalogKind,
		catalogMedia,
		discoverGenreId,
		discoverSortBy,
		peekIfRoomForMore,
	]);

	/**
	 * Re-sync when the RSC seed or catalogue mode changes — `useState(seedMovies)` only runs
	 * on mount, so client navigations (Latest ↔ Popular) would otherwise keep stale rows until
	 * refresh. `catalogueWaveKey` bundles medium + list + discover params so we reset even if two
	 * feeds share overlapping first-page ids.
	 */
	useEffect(() => {
		// `catalogueWaveKey` is read so this effect re-runs when sort/genre/medium changes even if
		// the server seed happens to reuse the same first-page ids as the previous surface.
		void catalogueWaveKey;
		setItems([...seedMovies]);
		nextPageRef.current = seedPage + 1;
		totalPagesRef.current = initialTotalPages;
		loadingRef.current = false;

		if (blockedReason) {
			setFooterState("exhausted");
		} else if (!initialTotalPages || seedPage >= initialTotalPages) {
			setFooterState("exhausted");
		} else {
			setFooterState("idle");
		}

		if (!blockedReason) {
			queueMicrotask(() => peekIfRoomForMore());
		}
	}, [
		blockedReason,
		catalogueWaveKey,
		initialTotalPages,
		peekIfRoomForMore,
		seedMovies,
		seedPage,
	]);

	useEffect(() => {
		loadMoreRef.current = loadMore;
	}, [loadMore]);

	/** IntersectionObserver — primary trigger for normal scroll velocities. */
	useEffect(() => {
		if (blockedReason) return;

		const el = sentinelRef.current;
		if (!el) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return;
				void loadMoreRef.current();
			},
			{ root: null, rootMargin: `${SCROLL_MARGIN_PX}px`, threshold: 0 },
		);

		observer.observe(el);
		return () => observer.disconnect();
	}, [blockedReason]);

	/** First paint — short catalogues sometimes keep the sentinel in view without an IO edge. */
	useEffect(() => {
		if (blockedReason) return;
		queueMicrotask(() => peekIfRoomForMore());
	}, [blockedReason, peekIfRoomForMore]);

	const catalogueLabel =
		catalogLabelProp ??
		(catalogKind === "upcoming"
			? "upcoming"
			: catalogKind === "discover"
				? "discover"
				: "popular");

	return (
		<>
			<div
				className={cn(
					gridClassName,
					// Lobby elevation + preference: when any tile is hovered/focused, other posters read monochrome (pure CSS `:has()`).
					posterHoverEffect === "elevation" &&
						monochromePeersOnHover &&
						cn(
							// Descendant `a` — grid cells may wrap `<MoviePoster>` in `motion.div` for stagger.
							"[&_a>.poster-art]:transition-[filter] [&_a>.poster-art]:duration-200 [&_a>.poster-art]:ease-out",
							"motion-reduce:[&_a>.poster-art]:transition-none",
							"[@media(hover:hover)]:[&:has(a:hover)_a:not(:hover)>.poster-art]:grayscale",
							"[&:has(a:focus-within)_a:not(:focus-within)>.poster-art]:grayscale",
						),
				)}
			>
				{items.map((m, index) => {
					const poster = (
						<MoviePoster
							className={posterLinkClassName}
							frameClassName={posterFrameClassName}
							hoverEffect={posterHoverEffect}
							listingKind={catalogMedia === "tv" ? "tv" : "movie"}
							movieId={m.id}
							posterUrl={m.poster_url}
							priority={index < 6}
							showTitle={showTitle}
							title={m.title}
						/>
					);

					if (!staggerPosterEntrance || reduceMotion) {
						return <Fragment key={m.id}>{poster}</Fragment>;
					}

					return (
						<motion.div
							key={`${catalogueWaveKey}-${m.id}`}
							className="min-w-0"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{
								// Slightly slower than default UI micro-motions so the lobby grid reads calm, not snappy.
								duration: 0.48,
								ease: [0.22, 1, 0.36, 1],
								delay: Math.min(index, 28) * 0.055,
							}}
						>
							{poster}
						</motion.div>
					);
				})}
			</div>

			{!blockedReason && footerState !== "exhausted" ? (
				<div
					ref={sentinelRef}
					className="pointer-events-none h-px w-full shrink-0"
					aria-hidden
				/>
			) : null}

			<div
				className="flex min-h-10 justify-center pt-4 pb-8"
				aria-live="polite"
				aria-busy={footerState === "loading"}
			>
				{footerState === "loading" ? (
					<>
						<Loader2
							className="size-7 animate-spin text-muted-foreground"
							aria-hidden
						/>
						<span className="sr-only">Loading more titles</span>
					</>
				) : null}
				{footerState === "error" ? (
					<p className="text-center text-muted-foreground text-sm">
						Something jammed fetching the next sheet —{" "}
						<button
							type="button"
							className="underline decoration-dashed underline-offset-2 hover:text-foreground"
							onClick={() => {
								loadingRef.current = false;
								setFooterState("idle");
								queueMicrotask(() => peekIfRoomForMore());
							}}
						>
							try again
						</button>
						.
					</p>
				) : null}
				{footerState === "exhausted" &&
				!blockedReason &&
				items.length > 0 &&
				totalResults > 0 ? (
					<p className="max-w-xl text-center text-muted-foreground text-xs">
						You’ve scrolled through{" "}
						<span className="tabular-nums">{items.length}</span>
						{items.length === 1 ? " title" : " titles"}
						{totalResults >= items.length
							? ` of ${totalResults.toLocaleString()} in TMDb’s ${catalogueLabel} catalogue.`
							: "."}
					</p>
				) : null}
			</div>
		</>
	);
}
