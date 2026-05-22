"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	Fragment,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import {
	MoviePoster,
	type MoviePosterHoverEffect,
} from "@/components/movie/movie-poster";
import type { CatalogueRadialSurface } from "@/lib/catalogue-radial-items";
import { HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import type { HomeVenue } from "@/lib/home-venue";
import {
	fetchMoviesDiscover,
	fetchMoviesNowPlaying,
	fetchMoviesPopular,
	fetchMoviesUpcoming,
	fetchTvDiscover,
	fetchTvOnTheAir,
	fetchTvPopular,
} from "@/lib/still-api-fetch";

export type PopularMovieSeed = {
	id: number;
	title: string;
	poster_url: string | null;
	/**
	 * When set, overrides `catalogMedia` for this cell’s detail link — used by `/diary` and
	 * `/watchlist` mixed grids so TV posters open `/tv/[id]` while films stay on `/movies/[id]`.
	 */
	listingKind?: "movie" | "tv";
	/** Diary TV scope chip — e.g. `S02E04` on poster overlay. */
	scopeLabel?: string | null;
};

export type TmdbCatalogKind =
	| "popular"
	| "upcoming"
	| "discover"
	| "now_playing"
	| "on_the_air";

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
	/** Discover: optional TMDb production company id (`with_companies`). */
	discoverCompanyId?: number | null;
	/** Discover: `sort_by` passthrough (server whitelist). */
	discoverSortBy?: string;
	/** Discover (movies): theatrical vs digital-at-home — forwarded as `?venue=` on `/api/movies/discover`. */
	discoverVenue?: HomeVenue | null;
	/** Discover: subscription/rent slice — `?monetization=` (pairs with server `watch_region`). */
	discoverMonetization?: string | null;
	/** Discover: optional `watch_region` override (ISO alpha-2). */
	discoverWatchRegion?: string | null;
	/** Discover: optional TMDb `region` (theatrical release territory; pairs with server date cap). */
	discoverReleaseRegion?: string | null;
	/** Discover (movies): optional `release_gte` (YYYY-MM-DD) for future primary-date windows. */
	discoverReleaseGte?: string | null;
	/** Discover (TV): optional `air_date_gte` → TMDb `first_air_date.gte` (YYYY-MM-DD). */
	discoverAirDateGte?: string | null;
	/** Discover (TV): `ended` / `completed` for finished series (`with_status=3`). */
	discoverTvStatus?: string | null;
	/**
	 * Theatrical upcoming (`catalogKind="upcoming"`) — optional ISO alpha-2 forwarded as
	 * `GET /api/movies/upcoming?region=` so paging matches the RSC seed territory.
	 */
	upcomingReleaseRegion?: string | null;
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
	/**
	 * When true, skip infinite scroll, intersection observers, and the TMDb “scrolled through”
	 * tail copy — reuse the same grid + poster stack as `/home` for static lists (e.g. diary).
	 */
	staticCatalogue?: boolean;
	/**
	 * Replaces the computed `catalogueWaveKey` for stagger / reset behaviour when the grid is
	 * not driven by TMDB query params (see `staticCatalogue`).
	 */
	catalogueWaveKeyOverride?: string;
	/**
	 * Stable React key per cell when `id` repeats (multiple screenings of the same title).
	 * Defaults to `String(movie.id)`.
	 */
	getPosterCellKey?: (movie: PopularMovieSeed, index: number) => string;
	/** When set with `signedIn`, lobby cells use `CataloguePosterTile` radial menus. */
	catalogueRadialSurface?: CatalogueRadialSurface;
	signedIn?: boolean;
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
	discoverCompanyId = null,
	discoverSortBy = "popularity.desc",
	discoverVenue = null,
	discoverMonetization = null,
	discoverWatchRegion = null,
	discoverReleaseRegion = null,
	discoverReleaseGte = null,
	discoverAirDateGte = null,
	discoverTvStatus = null,
	upcomingReleaseRegion = null,
	gridClassName = "grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-5 md:grid-cols-5 md:gap-6 lg:grid-cols-6 lg:gap-7",
	posterLinkClassName,
	posterFrameClassName,
	showTitle = true,
	catalogLabel: catalogLabelProp,
	posterHoverEffect = "lift",
	monochromePeersOnHover = true,
	staggerPosterEntrance = false,
	staticCatalogue = false,
	catalogueWaveKeyOverride,
	getPosterCellKey,
	catalogueRadialSurface,
	signedIn: _signedIn = false,
}: PopularMoviesInfiniteProps) {
	/** Single primitive for effect deps — mirrors `motion` remount keys below. */
	const catalogueWaveKey = `${catalogMedia}:${catalogKind}:${discoverSortBy}:${discoverGenreId ?? ""}:${discoverCompanyId ?? ""}:${discoverVenue ?? ""}:${discoverMonetization ?? ""}:${discoverWatchRegion ?? ""}:${discoverReleaseRegion ?? ""}:${discoverReleaseGte ?? ""}:${discoverAirDateGte ?? ""}:${discoverTvStatus ?? ""}:${upcomingReleaseRegion ?? ""}`;
	const waveKey = catalogueWaveKeyOverride ?? catalogueWaveKey;

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
		if (staticCatalogue) return;
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
	}, [staticCatalogue]);

	const loadMore = useCallback(async () => {
		if (staticCatalogue) return;
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
					? await fetchMoviesUpcoming(next, {
							region: upcomingReleaseRegion ?? undefined,
						})
					: catalogKind === "now_playing"
						? await fetchMoviesNowPlaying(next)
						: catalogKind === "on_the_air"
							? await fetchTvOnTheAir(next, {
									sortBy: discoverSortBy,
								})
							: catalogKind === "discover"
								? isTv
									? await fetchTvDiscover(next, {
											genreId: discoverGenreId ?? undefined,
											sortBy: discoverSortBy,
											airDateGte: discoverAirDateGte ?? undefined,
											monetization: discoverMonetization ?? undefined,
											watchRegion: discoverWatchRegion ?? undefined,
											status: discoverTvStatus ?? undefined,
										})
									: await fetchMoviesDiscover(next, {
											genreId: discoverGenreId ?? undefined,
											companyId: discoverCompanyId ?? undefined,
											sortBy: discoverSortBy,
											venue:
												catalogMedia === "movie" &&
												(discoverVenue === "theaters" ||
													discoverVenue === "streaming")
													? discoverVenue
													: undefined,
											monetization: discoverMonetization ?? undefined,
											watchRegion: discoverWatchRegion ?? undefined,
											region: discoverReleaseRegion ?? undefined,
											releaseGte: discoverReleaseGte ?? undefined,
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
		discoverCompanyId,
		discoverSortBy,
		discoverVenue,
		discoverMonetization,
		discoverWatchRegion,
		discoverReleaseRegion,
		discoverReleaseGte,
		discoverAirDateGte,
		discoverTvStatus,
		upcomingReleaseRegion,
		peekIfRoomForMore,
		staticCatalogue,
	]);

	/**
	 * Re-sync when the RSC seed or catalogue mode changes — `useState(seedMovies)` only runs
	 * on mount, so client navigations (Latest ↔ Popular) would otherwise keep stale rows until
	 * refresh. `catalogueWaveKey` bundles medium + list + discover params so we reset even if two
	 * feeds share overlapping first-page ids.
	 */
	useEffect(() => {
		// `waveKey` is read so this effect re-runs when sort/genre/medium changes even if
		// the server seed happens to reuse the same first-page ids as the previous surface.
		void waveKey;
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

		if (!staticCatalogue && !blockedReason) {
			queueMicrotask(() => peekIfRoomForMore());
		}
	}, [
		blockedReason,
		waveKey,
		initialTotalPages,
		peekIfRoomForMore,
		seedMovies,
		seedPage,
		staticCatalogue,
	]);

	useEffect(() => {
		loadMoreRef.current = loadMore;
	}, [loadMore]);

	/** IntersectionObserver — primary trigger for normal scroll velocities. */
	useEffect(() => {
		if (staticCatalogue || blockedReason) return;

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
	}, [blockedReason, staticCatalogue]);

	/** First paint — short catalogues sometimes keep the sentinel in view without an IO edge. */
	useEffect(() => {
		if (staticCatalogue || blockedReason) return;
		queueMicrotask(() => peekIfRoomForMore());
	}, [blockedReason, peekIfRoomForMore, staticCatalogue]);

	const catalogueLabel =
		catalogLabelProp ??
		(catalogKind === "upcoming"
			? "upcoming"
			: catalogKind === "now_playing"
				? "now playing in theatres"
				: catalogKind === "on_the_air"
					? "currently on the air"
					: catalogKind === "discover"
						? "discover"
						: "popular");

	/** Shared poster subtree for lobby grids — duplicated map branches would drift otherwise. */
	const renderLobbyMoviePoster = useCallback(
		(m: PopularMovieSeed, index: number) => {
			const listingKind =
				m.listingKind ?? (catalogMedia === "tv" ? "tv" : "movie");
			if (catalogueRadialSurface) {
				return (
					<CataloguePosterTile
						className={posterLinkClassName}
						frameClassName={posterFrameClassName}
						hoverEffect={posterHoverEffect}
						listingKind={listingKind}
						posterCaption={m.scopeLabel}
						posterUrl={m.poster_url}
						priority={index < 6}
						surface={catalogueRadialSurface}
						title={m.title}
						tmdbId={m.id}
					/>
				);
			}
			return (
				<MoviePoster
					className={posterLinkClassName}
					frameClassName={posterFrameClassName}
					hoverEffect={posterHoverEffect}
					listingKind={listingKind}
					movieId={m.id}
					posterUrl={m.poster_url}
					priority={index < 6}
					posterCaption={m.scopeLabel}
					showTitle={showTitle}
					title={m.title}
				/>
			);
		},
		[
			catalogueRadialSurface,
			posterLinkClassName,
			posterFrameClassName,
			posterHoverEffect,
			catalogMedia,
			showTitle,
		],
	);

	const motionPosterCells = staggerPosterEntrance && !reduceMotion;

	/**
	 * `AnimatePresence` diffs its **`children` prop by reference** (see FM `presentChildren !== diffedChildren`).
	 * A fresh `items.map(...)` every render makes that check true on *every* paint, so exit state never
	 * stabilises and tiles vanish instantly. Memo keeps the element list stable unless `items` (or
	 * poster props) actually change — then removals run `exit` as intended.
	 *
	 * Presence **`key`** must include **`waveKey`** (catalogue slice / diary filter) as well as the
	 * stable cell id (`log` id or TMDb id). Otherwise a title that appears in *both* feeds is reused
	 * by React — it never unmounts, so it skips `exit` while neighbours that dropped out of TMDB
	 * results *do* exit → inconsistent grid animation when filters change.
	 */
	const presenceChildren = useMemo(() => {
		if (!motionPosterCells) return null;
		return items.map((m, index) => {
			const cellKey = getPosterCellKey?.(m, index) ?? String(m.id);
			// Wave-scoped key: same movie in “Latest” vs “Popular” is two different presence lifecycles.
			const presenceKey = `${waveKey}::${cellKey}`;
			return (
				<motion.div
					key={presenceKey}
					layout={false}
					className="min-w-0"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{
						opacity: 0,
						transition: {
							duration: 0.18,
							ease: [0.22, 1, 0.36, 1],
						},
					}}
					transition={{
						// Opacity-only stagger — `popLayout` reflow on the grid caused flicker; keep calm cadence.
						duration: 0.48,
						ease: [0.22, 1, 0.36, 1],
						delay: Math.min(index, 28) * 0.055,
					}}
				>
					{renderLobbyMoviePoster(m, index)}
				</motion.div>
			);
		});
	}, [
		motionPosterCells,
		waveKey,
		items,
		getPosterCellKey,
		renderLobbyMoviePoster,
	]);

	return (
		<>
			<div
				className={cn(
					gridClassName,
					// Lobby elevation + preference: when any tile is hovered/focused, other posters read monochrome (pure CSS `:has()`).
					posterHoverEffect === "elevation" &&
						monochromePeersOnHover &&
						HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
				)}
			>
				{presenceChildren ? (
					// `AnimatePresence` + wave-scoped keys (see `presenceChildren` memo) so every tile exits
					// when the catalogue slice changes, not only ids that disappear from TMDB between feeds.
					<AnimatePresence mode="sync">{presenceChildren}</AnimatePresence>
				) : (
					items.map((m, index) => {
						const cellKey = getPosterCellKey?.(m, index) ?? String(m.id);
						return (
							<Fragment key={cellKey}>
								{renderLobbyMoviePoster(m, index)}
							</Fragment>
						);
					})
				)}
			</div>

			{!staticCatalogue && !blockedReason && footerState !== "exhausted" ? (
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
				!staticCatalogue &&
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
