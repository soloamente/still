"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CataloguePosterGroup } from "@/components/catalogue/catalogue-poster-group";
import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { DiaryTvEpisodeDialog } from "@/components/diary/diary-tv-episode-dialog";
import { DiaryTvGroupCell } from "@/components/diary/diary-tv-group-cell";
import {
	chooseDiaryTvPoster,
	completeDiaryTvDialogClose,
	type DiaryTvDialogSession,
	type DiaryTvDialogShow,
	dismissDiaryTvDialog,
	syncDiaryTvDialogToGrid,
} from "@/lib/diary-tv-episode-dialog-session";
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
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { formatTvLogScopeLabel } from "@/lib/tv-log-scope-display";

function tmdbPosterUrl(posterPath: string | null): string | null {
	// Lobby grid cells — w342 matches display size better than w780.
	return tmdbPosterUrlFromPath(posterPath, "w342");
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
	// One episode dialog for the whole lobby. A second poster waits until the
	// current flight home finishes. Escape, scrim, and Close never toggle it open.
	const [session, setSession] = useState<DiaryTvDialogSession>({
		phase: "closed",
	});
	const [concealedKey, setConcealedKey] = useState<string | null>(null);
	const itemsRef = useRef(items);
	itemsRef.current = items;
	const cellMapRef = useRef(new Map<string, HTMLElement>());
	const flightCellRef = useRef<HTMLElement | null>(null);
	const activeShow = session.phase === "closed" ? null : session.show;
	const activeShowKeyRef = useRef<string | null>(null);
	activeShowKeyRef.current = activeShow?.key ?? null;
	// Sync before paint. The cell's unmount ref runs after this render and
	// clears the node when that show leaves the grid.
	if (activeShow) {
		flightCellRef.current = cellMapRef.current.get(activeShow.key) ?? null;
	} else {
		flightCellRef.current = null;
	}
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

	// Re-seed when the server sends a new first page (chip nav or a diary refresh).
	// A Quick Log save refreshes `/diary` while the episode dialog is open — keep
	// that show when it is still in the new seeds. If it left, start a close so
	// the dialog can fade instead of unmounting with the cell.
	useEffect(() => {
		seedGenRef.current += 1;
		abortRef.current?.abort();
		abortRef.current = null;
		setItems([...seeds]);
		nextPageRef.current = 2;
		loadingRef.current = false;
		const presentKeys = new Set(seeds.map((row) => rowKey(row)));
		setSession((current) => syncDiaryTvDialogToGrid(current, presentKeys));
		setFooterState(totalPages <= 1 ? "exhausted" : "idle");
	}, [seeds, totalPages]);

	const showFromKey = useCallback((key: string): DiaryTvDialogShow | null => {
		for (const row of itemsRef.current) {
			if (row.kind !== "tvGroup") continue;
			if (rowKey(row) !== key) continue;
			return {
				key,
				tmdbId: row.tv.tmdbId,
				title: row.tv.title,
				posterPath: row.tv.posterPath,
			};
		}
		return null;
	}, []);

	const registerCell = useCallback((key: string, node: HTMLElement | null) => {
		if (node) cellMapRef.current.set(key, node);
		else cellMapRef.current.delete(key);
		if (activeShowKeyRef.current === key) {
			flightCellRef.current = node;
		}
	}, []);

	const handlePosterClick = useCallback(
		(key: string) => {
			setSession((prev) => chooseDiaryTvPoster(prev, key, showFromKey));
		},
		[showFromKey],
	);

	// Scrim, Close, and Escape. Clears a queued poster so the dialog cannot reopen.
	const handleDismiss = useCallback(() => {
		setSession((prev) => dismissDiaryTvDialog(prev));
	}, []);

	const handleExitComplete = useCallback(() => {
		setSession((prev) => completeDiaryTvDialogClose(prev, showFromKey));
	}, [showFromKey]);

	const handleConcealPoster = useCallback((concealed: boolean) => {
		const key = activeShowKeyRef.current;
		setConcealedKey(concealed && key ? key : null);
	}, []);

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
							expanded={activeShow?.key === key}
							concealPoster={concealedKey === key}
							onPosterClick={() => handlePosterClick(key)}
							onCellNode={(node) => {
								registerCell(key, node);
							}}
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
		[items, activeShow?.key, concealedKey, handlePosterClick, registerCell],
	);

	return (
		<>
			<CataloguePosterGroup
				ref={gridRef}
				className={cn(
					HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
					monochromePeersOnHover &&
						HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
				)}
			>
				{cells}
			</CataloguePosterGroup>

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
			{activeShow ? (
				<DiaryTvEpisodeDialog
					key={activeShow.key}
					open={session.phase === "open"}
					onOpenChange={(next) => {
						if (next) return;
						handleDismiss();
					}}
					tmdbId={activeShow.tmdbId}
					title={activeShow.title}
					posterPath={activeShow.posterPath}
					cellRef={flightCellRef}
					cellInGrid={items.some((row) => rowKey(row) === activeShow.key)}
					onConcealPoster={handleConcealPoster}
					onExitComplete={handleExitComplete}
				/>
			) : null}
		</>
	);
}
