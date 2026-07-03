"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { HomeTasteMatchedRailSkeleton } from "@/components/home/home-taste-matched-rail-skeleton";
import { api } from "@/lib/api";
import {
	HOME_TASTE_MATCHED_RAIL_CELL_CLASSNAME,
	HOME_TASTE_MATCHED_RAIL_TRACK_CLASSNAME,
} from "@/lib/home-taste-matched-rail-layout";
import {
	buildTasteQueueBackfillRunner,
	createTasteQueueBackfillScheduler,
} from "@/lib/taste-match-queue";
import {
	TASTE_MATCH_MIN_RESULTS,
	type TasteMatchedDiscoveryPayload,
	type TasteMatchMovie,
	tasteMatchedRailTitle,
} from "@/lib/taste-matched-discovery";
import {
	TASTE_TITLE_CONSUMED_EVENT,
	type TasteTitleConsumedDetail,
} from "@/lib/taste-title-consumed-events";
import { useTasteRailVisibleCount } from "@/lib/use-taste-rail-visible-count";

const RAIL_POSTER_FRAME_CLASSNAME = "rounded-2xl border-0 bg-background";

function tmdbPosterUrl(posterPath: string | null): string | null {
	if (!posterPath?.length) return null;
	if (posterPath.startsWith("http")) return posterPath;
	const fragment = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
}

function tasteRailIsEmpty(movies: TasteMatchMovie[]): boolean {
	return movies.length < TASTE_MATCH_MIN_RESULTS;
}

/**
 * Signed-in Movies lobby rail — rule-based picks from diary taste (ST.4).
 * Prefer `initial` from `/home` RSC so the rail paints with the catalogue, not after a client waterfall.
 */
export function HomeTasteMatchedRail({
	initial,
}: {
	/** From `GET /api/taste/for-you` on the home RSC; omit only for client-only fallback. */
	initial?: TasteMatchedDiscoveryPayload | null;
}) {
	const reduceMotion = useReducedMotion();
	const [payload, setPayload] = useState<TasteMatchedDiscoveryPayload | null>(
		initial ?? null,
	);
	const [movies, setMovies] = useState<TasteMatchMovie[]>(() =>
		initial && !initial.coldStart ? initial.movies : [],
	);
	const [genrePhrase, setGenrePhrase] = useState<string | null>(
		initial && !initial.coldStart ? (initial.genrePhrase ?? null) : null,
	);
	const [loading, setLoading] = useState(initial === undefined);
	const { trackRef, visibleCount } = useTasteRailVisibleCount();
	const moviesRef = useRef(movies);
	const backfillSchedulerRef = useRef<ReturnType<
		typeof createTasteQueueBackfillScheduler
	> | null>(null);

	useEffect(() => {
		moviesRef.current = movies;
	}, [movies]);

	useEffect(() => {
		if (initial === undefined) return;
		setPayload(initial);
		setMovies(initial && !initial.coldStart ? initial.movies : []);
		setGenrePhrase(
			initial && !initial.coldStart ? (initial.genrePhrase ?? null) : null,
		);
		setLoading(false);
	}, [initial]);

	useEffect(() => {
		if (initial !== undefined) return;

		let cancelled = false;
		async function load() {
			try {
				const res = await api.api.taste["for-you"].get();
				if (cancelled) return;
				if (res.error || !res.data) {
					setPayload(null);
					setMovies([]);
					return;
				}
				const data = res.data as TasteMatchedDiscoveryPayload;
				setPayload(data);
				setMovies(data.coldStart ? [] : data.movies);
				setGenrePhrase(data.coldStart ? null : (data.genrePhrase ?? null));
			} catch {
				if (!cancelled) {
					setPayload(null);
					setMovies([]);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [initial]);

	const fetchTasteForYou = useCallback(async () => {
		try {
			const res = await api.api.taste["for-you"].get();
			if (res.error || !res.data) return null;
			return res.data as TasteMatchedDiscoveryPayload;
		} catch {
			return null;
		}
	}, []);

	useEffect(() => {
		const scheduler = createTasteQueueBackfillScheduler({
			runBackfill: buildTasteQueueBackfillRunner({
				getMovies: () => moviesRef.current,
				setMovies,
				fetchForYou: fetchTasteForYou,
			}),
		});
		backfillSchedulerRef.current = scheduler;
		return () => {
			scheduler.cancel();
			backfillSchedulerRef.current = null;
		};
	}, [fetchTasteForYou]);

	const removeFromQueue = useCallback((tmdbId: number) => {
		const snapshot = moviesRef.current;
		const index = snapshot.findIndex((film) => film.tmdbId === tmdbId);
		if (index < 0) return false;

		setMovies((prev) => prev.filter((film) => film.tmdbId !== tmdbId));
		backfillSchedulerRef.current?.schedule();
		return true;
	}, []);

	const handleNotInterested = useCallback(async (tmdbId: number) => {
		const snapshot = moviesRef.current;
		const index = snapshot.findIndex((film) => film.tmdbId === tmdbId);
		if (index < 0) return;

		setMovies((prev) => prev.filter((film) => film.tmdbId !== tmdbId));

		try {
			const res = await api.api.taste.dismiss.post({
				movieTmdbId: tmdbId,
				excludeTmdbIds: snapshot.map((film) => film.tmdbId),
			});
			if (res.error || !res.data) {
				throw new Error("dismiss failed");
			}
			backfillSchedulerRef.current?.schedule();
		} catch {
			setMovies(snapshot);
			toast.error("Couldn't update suggestions");
		}
	}, []);

	/** After quick log or watchlist add, drop the title and backfill at the tail. */
	const handleTitleConsumed = useCallback(
		(tmdbId: number) => {
			removeFromQueue(tmdbId);
		},
		[removeFromQueue],
	);

	useEffect(() => {
		const onConsumed = (event: Event) => {
			const detail = (event as CustomEvent<TasteTitleConsumedDetail>).detail;
			if (detail?.tmdbId != null) {
				handleTitleConsumed(detail.tmdbId);
			}
		};
		window.addEventListener(TASTE_TITLE_CONSUMED_EVENT, onConsumed);
		return () =>
			window.removeEventListener(TASTE_TITLE_CONSUMED_EVENT, onConsumed);
	}, [handleTitleConsumed]);

	if (loading) {
		return <HomeTasteMatchedRailSkeleton />;
	}

	if (!payload || payload.coldStart || tasteRailIsEmpty(movies)) {
		return null;
	}

	const visibleMovies = movies.slice(0, visibleCount);

	return (
		<section
			aria-label="Films matched to your taste"
			className="w-full min-w-0 space-y-2.5"
		>
			<h2 className="text-balance text-center font-medium text-muted-foreground text-xs tracking-wide">
				{tasteMatchedRailTitle(genrePhrase)}
			</h2>
			<div ref={trackRef} className={HOME_TASTE_MATCHED_RAIL_TRACK_CLASSNAME}>
				<AnimatePresence initial={false} mode="popLayout">
					{visibleMovies.map((film, index) => (
						<motion.div
							key={film.tmdbId}
							layout={!reduceMotion}
							initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
							transition={
								reduceMotion
									? { duration: 0 }
									: { duration: 0.15, ease: "easeOut" }
							}
							className={HOME_TASTE_MATCHED_RAIL_CELL_CLASSNAME}
						>
							<CataloguePosterTile
								className="w-full min-w-0"
								frameClassName={RAIL_POSTER_FRAME_CLASSNAME}
								hoverEffect="elevation"
								listingKind="movie"
								onActionComplete={() => handleTitleConsumed(film.tmdbId)}
								onNotInterested={handleNotInterested}
								posterUrl={tmdbPosterUrl(film.posterPath)}
								priority={index < 4}
								surface="taste-rail"
								title={film.title}
								tmdbId={film.tmdbId}
							/>
							<p className="mt-1.5 line-clamp-2 w-full text-center text-[11px] text-muted-foreground leading-snug">
								{film.title}
							</p>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</section>
	);
}
