"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { DiaryTvGroupCell } from "@/components/diary/diary-tv-group-cell";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	type DiaryResultRow,
	type FetchMyDiaryOpts,
	fetchMyDiary,
} from "@/lib/still-api-fetch";
import { formatTvLogScopeLabel } from "@/lib/tv-log-scope-display";

function tmdbPosterUrl(posterPath: string | null): string | null {
	if (!posterPath?.length) return null;
	if (posterPath.startsWith("http")) return posterPath;
	const fragment = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
}

/** Stable cross-page key per cell. */
function rowKey(row: DiaryResultRow): string {
	return row.kind === "movie" ? `movie:${row.log.id}` : `tv:${row.tv.tmdbId}`;
}

const SCROLL_MARGIN_PX = 280;

export function DiaryLobbyInfinite({
	seeds,
	totalPages,
	query,
	monochromePeersOnHover,
}: {
	seeds: DiaryResultRow[];
	totalPages: number;
	query: Omit<FetchMyDiaryOpts, "signal">;
	monochromePeersOnHover: boolean;
}) {
	const gridRef = useRef<HTMLDivElement>(null);
	const [items, setItems] = useState<DiaryResultRow[]>(() => [...seeds]);
	const [expandedKey, setExpandedKey] = useState<string | null>(null);
	const [footerState, setFooterState] = useState<
		"idle" | "loading" | "exhausted" | "error"
	>(() => (totalPages <= 1 ? "exhausted" : "idle"));

	const nextPageRef = useRef(2);
	const totalPagesRef = useRef(totalPages);
	totalPagesRef.current = totalPages;
	const loadingRef = useRef(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const loadMoreRef = useRef<() => Promise<void>>(async () => {});
	const seedGenRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);

	// Re-seed when the server sends a new first page (chip nav changes query).
	useEffect(() => {
		seedGenRef.current += 1;
		abortRef.current?.abort();
		abortRef.current = null;
		setItems([...seeds]);
		nextPageRef.current = 2;
		loadingRef.current = false;
		setExpandedKey(null);
		setFooterState(totalPages <= 1 ? "exhausted" : "idle");
	}, [seeds, totalPages]);

	const handleToggleExpand = useCallback((key: string) => {
		setExpandedKey((prev) => (prev === key ? null : key));
	}, []);

	// Collapse expanded TV card on outside click / Escape.
	useEffect(() => {
		if (!expandedKey) return;
		const onPointerDown = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (gridRef.current?.contains(target)) return;
			setExpandedKey(null);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setExpandedKey(null);
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [expandedKey]);

	const peekIfRoomForMore = useCallback(() => {
		if (typeof window === "undefined") return;
		if (loadingRef.current) return;
		if (nextPageRef.current > totalPagesRef.current) return;
		const el = sentinelRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		if (r.top <= window.innerHeight + SCROLL_MARGIN_PX) {
			void loadMoreRef.current();
		}
	}, []);

	const loadMore = useCallback(async () => {
		const next = nextPageRef.current;
		if (next > totalPagesRef.current) {
			setFooterState("exhausted");
			return;
		}
		if (loadingRef.current) return;
		loadingRef.current = true;
		setFooterState("loading");

		const gen = seedGenRef.current;
		const controller = new AbortController();
		abortRef.current = controller;

		let res: Awaited<ReturnType<typeof fetchMyDiary>> | { error: true };
		try {
			res = await fetchMyDiary(next, { ...query, signal: controller.signal });
		} catch {
			// Aborted by a re-seed, or a network throw — drop if superseded.
			if (gen !== seedGenRef.current) return;
			loadingRef.current = false;
			setFooterState("error");
			return;
		}

		// A chip change re-seeded while we were fetching — discard stale results.
		if (gen !== seedGenRef.current) return;

		loadingRef.current = false;
		if ("error" in res) {
			setFooterState("error");
			return;
		}
		if (res.total_pages > 0) totalPagesRef.current = res.total_pages;
		setItems((prev) => {
			const seen = new Set(prev.map(rowKey));
			const out = [...prev];
			for (const row of res.results) {
				const k = rowKey(row);
				if (!seen.has(k)) {
					seen.add(k);
					out.push(row);
				}
			}
			return out;
		});
		nextPageRef.current = next + 1;
		const depleted =
			res.results.length === 0 || nextPageRef.current > totalPagesRef.current;
		setFooterState(depleted ? "exhausted" : "idle");
		if (!depleted) queueMicrotask(() => peekIfRoomForMore());
	}, [query, peekIfRoomForMore]);

	useEffect(() => {
		loadMoreRef.current = loadMore;
	}, [loadMore]);

	const showSentinel = footerState !== "exhausted";

	useEffect(() => {
		if (!showSentinel) return;
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) void loadMoreRef.current();
			},
			{ root: null, rootMargin: `${SCROLL_MARGIN_PX}px`, threshold: 0 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [showSentinel]);

	useEffect(() => {
		queueMicrotask(() => peekIfRoomForMore());
	}, [peekIfRoomForMore]);

	const cells = useMemo(
		() =>
			items.map((item, index) => {
				const key = rowKey(item);
				if (item.kind === "tvGroup") {
					return (
						<DiaryTvGroupCell
							key={key}
							tmdbId={item.tv.tmdbId}
							title={item.tv.title}
							posterPath={item.tv.posterPath}
							logCount={item.logCount}
							primaryLabel={formatTvLogScopeLabel(
								item.primaryScope.logScope,
								item.primaryScope.seasonNumber,
								item.primaryScope.episodeNumber,
							)}
							expanded={expandedKey === key}
							onToggleExpand={() => handleToggleExpand(key)}
							priority={index < 6}
						/>
					);
				}
				return (
					<div key={key} className="min-w-0">
						<CataloguePosterTile
							className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
							diaryRow={{
								log: {
									id: item.log.id,
									watchedAt: item.log.watchedAt,
									createdAt: item.log.createdAt,
									rating: item.log.rating,
									liked: item.log.liked,
									rewatch: item.log.rewatch,
									note: null,
									watchVenue: item.log.watchVenue ?? undefined,
								},
								movie: {
									tmdbId: item.movie.tmdbId,
									title: item.movie.title,
									posterPath: item.movie.posterPath,
									year: null,
								},
								tv: null,
							}}
							frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
							hoverEffect="elevation"
							listingKind="movie"
							posterUrl={tmdbPosterUrl(item.movie.posterPath)}
							priority={index < 6}
							surface="diary"
							title={item.movie.title}
							tmdbId={item.movie.tmdbId}
						/>
					</div>
				);
			}),
		[items, expandedKey, handleToggleExpand],
	);

	return (
		<>
			<div
				ref={gridRef}
				className={cn(
					HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
					monochromePeersOnHover &&
						HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
				)}
			>
				{cells}
			</div>

			{showSentinel ? (
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
						<span className="sr-only">Loading more diary entries</span>
					</>
				) : null}
				{footerState === "error" ? (
					<p className="text-center text-muted-foreground text-sm">
						Something jammed loading more —{" "}
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
			</div>
		</>
	);
}
