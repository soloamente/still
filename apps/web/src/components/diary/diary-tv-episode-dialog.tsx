"use client";

import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import Image from "next/image";
import {
	type RefObject,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { diaryLogToQuickLogOpenPayload } from "@/lib/diary-open-log";
import {
	type DiaryTvEpisodeLog,
	type DiaryTvPill,
	initialSeasonNumber,
	pillForEpisode,
	seasonLogLabel,
	showLogLabel,
} from "@/lib/diary-tv-episode-pills";
import { formatLogRatingDisplay } from "@/lib/log-rating";
import type { MyTvLog } from "@/lib/my-tv-log";
import {
	fetchMyLogsForTv,
	fetchTvSeasonDetail,
	fetchTvSeasons,
} from "@/lib/still-api-fetch";
import { isTmdbCdnUrl, tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import type { TvEpisodeSummary, TvSeasonSummary } from "@/lib/tv-watch-types";

/** Mix `foreground` into `background` — 0 is empty, 10 is full foreground. */
function ratedMixPercent(averageDisplay: number): number {
	return Math.round((averageDisplay / 10) * 100);
}

function ratedPillBackground(averageDisplay: number): string {
	return `color-mix(in oklab, var(--foreground) ${ratedMixPercent(averageDisplay)}%, var(--background))`;
}

function ratedPillTextClass(averageDisplay: number): string {
	return ratedMixPercent(averageDisplay) > 55
		? "text-background"
		: "text-foreground";
}

/**
 * Same field names as the former `tvLogsToDiaryRows` mapper on `DiaryTvGroupCell`.
 * Keep this aligned so Quick Log still receives the diary row shape.
 */
function tvLogsToDiaryRows(
	data: unknown,
	tmdbId: number,
	title: string,
	posterPath: string | null,
): DiaryLogRow[] {
	if (!Array.isArray(data)) return [];
	const listing = { tmdbId, title, posterPath, year: null };
	return (data as MyTvLog[]).map((l) => ({
		log: {
			id: l.id,
			watchedAt: l.watchedAt ?? new Date(0).toISOString(),
			createdAt: undefined,
			rating: l.rating ?? null,
			liked: l.liked,
			rewatch: l.rewatch ?? false,
			note: l.note ?? null,
			logScope: l.logScope ?? "show",
			seasonNumber: l.seasonNumber ?? null,
			episodeNumber: l.episodeNumber ?? null,
		},
		movie: null,
		tv: listing,
	}));
}

function episodeLogsFromRows(
	rows: readonly DiaryLogRow[],
): DiaryTvEpisodeLog[] {
	return rows.map((row) => ({
		id: row.log.id,
		logScope: row.log.logScope ?? "show",
		seasonNumber: row.log.seasonNumber ?? null,
		episodeNumber: row.log.episodeNumber ?? null,
		rating: row.log.rating,
		watchedAt: row.log.watchedAt,
	}));
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

function seasonPosterSrc(
	seasonPosterPath: string | null | undefined,
	showPosterPath: string | null,
): string | null {
	// Season art first; fall back to the show poster when TMDb has none.
	return tmdbPosterUrlFromPath(seasonPosterPath ?? showPosterPath, "w342");
}

function loadingPillKeys(seasonNumber: number, episodeCount: number): string[] {
	const count = Math.max(episodeCount, 1);
	return Array.from(
		{ length: count },
		(_, slot) => `${seasonNumber}-loading-${slot + 1}`,
	);
}

function EpisodePill({
	pill,
	episodeNumber,
	onOpenLog,
}: {
	pill: DiaryTvPill;
	episodeNumber: number;
	onOpenLog: (latestLogId: string) => void;
}) {
	switch (pill.kind) {
		case "empty":
			return (
				<span className="inline-flex min-h-11 min-w-11 select-none items-center justify-center rounded-full px-3 font-medium text-muted-foreground text-sm tabular-nums">
					{episodeNumber}
				</span>
			);
		case "neutral":
			return (
				<button
					type="button"
					className="inline-flex min-h-11 min-w-11 cursor-pointer select-none items-center justify-center rounded-full bg-background px-3 font-medium text-foreground text-sm tabular-nums"
					onClick={() => onOpenLog(pill.latestLogId)}
				>
					{episodeNumber}
				</button>
			);
		case "rated":
			return (
				<button
					type="button"
					className={cn(
						"inline-flex min-h-11 min-w-11 cursor-pointer select-none items-center justify-center rounded-full px-3 font-semibold text-sm tabular-nums",
						ratedPillTextClass(pill.averageDisplay),
					)}
					style={{ background: ratedPillBackground(pill.averageDisplay) }}
					onClick={() => onOpenLog(pill.latestLogId)}
				>
					{formatLogRatingDisplay(pill.averageDisplay)}
				</button>
			);
		default: {
			const _exhaustive: never = pill;
			return _exhaustive;
		}
	}
}

function SeasonPosterThumb({
	src,
	label,
	active,
	onSelect,
}: {
	src: string | null;
	label: string;
	active: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			aria-current={active ? "true" : undefined}
			aria-label={label}
			className={cn(
				"relative aspect-2/3 min-h-11 w-11 cursor-pointer select-none overflow-hidden rounded-lg bg-background",
				active ? "opacity-100" : "opacity-50",
			)}
			onClick={onSelect}
		>
			{src ? (
				<Image
					src={src}
					alt=""
					fill
					sizes="44px"
					className="object-cover"
					unoptimized={isTmdbCdnUrl(src)}
				/>
			) : (
				<span className="grid size-full place-items-center px-1 text-center text-[10px] text-muted-foreground leading-tight">
					{label}
				</span>
			)}
		</button>
	);
}

function LegendSwatch({
	label,
	background,
	textClass,
	children,
}: {
	label: string;
	background?: string;
	textClass?: string;
	children: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<span
				aria-hidden
				className={cn(
					"inline-flex size-8 items-center justify-center rounded-full text-[11px] tabular-nums",
					textClass,
					!background && "bg-background",
				)}
				style={background ? { background } : undefined}
			>
				{children}
			</span>
			<span className="text-muted-foreground text-xs">{label}</span>
		</div>
	);
}

export function DiaryTvEpisodeDialog({
	open,
	onOpenChange,
	tmdbId,
	title,
	posterPath,
	cellRef: _cellRef,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	title: string;
	posterPath: string | null;
	/** Grid cell root — Task 4 measures this for the poster flight. */
	cellRef: RefObject<HTMLElement | null>;
}) {
	const titleId = useId();
	const openQuickLog = useQuickLog((s) => s.open);
	const quickLogOpen = useQuickLog((s) => s.isOpen);
	const [mounted, setMounted] = useState(false);
	const [logRows, setLogRows] = useState<DiaryLogRow[]>([]);
	const [seasons, setSeasons] = useState<TvSeasonSummary[]>([]);
	const [episodesBySeason, setEpisodesBySeason] = useState<
		Record<number, TvEpisodeSummary[]>
	>({});
	const [seasonFailed, setSeasonFailed] = useState<Record<number, boolean>>({});
	const [activeSeason, setActiveSeason] = useState<number | null>(null);
	const [seasonsError, setSeasonsError] = useState(false);
	const [diaryError, setDiaryError] = useState(false);
	const [seasonsLoading, setSeasonsLoading] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);
	const groupRefs = useRef(new Map<number, HTMLElement>());
	const skipScrollSyncRef = useRef(false);

	const episodeLogs = useMemo(
		() => (diaryError ? [] : episodeLogsFromRows(logRows)),
		[diaryError, logRows],
	);
	const seriesLabel = useMemo(() => showLogLabel(episodeLogs), [episodeLogs]);
	const activeSeasonRow = seasons.find(
		(season) => season.season_number === activeSeason,
	);
	const largePosterSrc = seasonPosterSrc(
		activeSeasonRow?.poster_path,
		posterPath,
	);

	useEffect(() => {
		setMounted(true);
	}, []);

	const applyDiaryResult = useCallback(
		(data: unknown, failed: boolean) => {
			if (failed) {
				setDiaryError(true);
				setLogRows([]);
				return;
			}
			setDiaryError(false);
			setLogRows(tvLogsToDiaryRows(data, tmdbId, title, posterPath));
		},
		[posterPath, title, tmdbId],
	);

	const loadSeasonEpisodes = useCallback(
		async (seasonNumber: number, signal?: AbortSignal) => {
			setSeasonFailed((prev) => ({ ...prev, [seasonNumber]: false }));
			try {
				const result = await fetchTvSeasonDetail(tmdbId, seasonNumber, {
					signal,
				});
				if (signal?.aborted) return;
				const episodes = result.data?.season?.episodes;
				if (result.error || !episodes) {
					setSeasonFailed((prev) => ({ ...prev, [seasonNumber]: true }));
					return;
				}
				const ordered = [...episodes].sort(
					(a, b) => a.episode_number - b.episode_number,
				);
				setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: ordered }));
			} catch (error) {
				if (isAbortError(error) || signal?.aborted) return;
				setSeasonFailed((prev) => ({ ...prev, [seasonNumber]: true }));
			}
		},
		[tmdbId],
	);

	const loadCatalogue = useCallback(
		async (signal: AbortSignal) => {
			setSeasonsLoading(true);
			setSeasonsError(false);
			setSeasons([]);
			setEpisodesBySeason({});
			setSeasonFailed({});
			setActiveSeason(null);

			const [logsOutcome, seasonsOutcome] = await Promise.all([
				fetchMyLogsForTv(tmdbId, { signal }).catch((error: unknown) => {
					if (isAbortError(error)) return null;
					return { data: null, error: { status: 0 } };
				}),
				fetchTvSeasons(tmdbId, { signal }).catch((error: unknown) => {
					if (isAbortError(error)) return null;
					return { data: null, error: { status: 0 } };
				}),
			]);
			if (signal.aborted) return;

			if (
				!logsOutcome ||
				logsOutcome.error ||
				!Array.isArray(logsOutcome.data)
			) {
				applyDiaryResult(null, true);
			} else {
				applyDiaryResult(logsOutcome.data, false);
			}

			if (
				!seasonsOutcome ||
				seasonsOutcome.error ||
				!seasonsOutcome.data?.seasons
			) {
				setSeasonsError(true);
				setSeasonsLoading(false);
				return;
			}

			const usable = seasonsOutcome.data.seasons
				.filter((season) => season.episode_count > 0)
				.sort((a, b) => a.season_number - b.season_number);
			setSeasons(usable);
			setSeasonsLoading(false);

			const diaryRows = Array.isArray(logsOutcome?.data)
				? tvLogsToDiaryRows(logsOutcome.data, tmdbId, title, posterPath)
				: [];
			const nextActive = initialSeasonNumber(
				episodeLogsFromRows(diaryRows),
				usable.map((season) => season.season_number),
			);
			setActiveSeason(nextActive);

			// Active season first so its pills paint before the rest of the catalogue.
			if (nextActive != null) {
				await loadSeasonEpisodes(nextActive, signal);
			}
			if (signal.aborted) return;
			const remaining = usable.filter(
				(season) => season.season_number !== nextActive,
			);
			await Promise.all(
				remaining.map((season) =>
					loadSeasonEpisodes(season.season_number, signal),
				),
			);
		},
		[applyDiaryResult, loadSeasonEpisodes, posterPath, title, tmdbId],
	);

	useEffect(() => {
		if (!open) return;
		const controller = new AbortController();
		void loadCatalogue(controller.signal);
		return () => {
			controller.abort();
		};
	}, [loadCatalogue, open]);

	const refetchDiary = useCallback(async () => {
		try {
			const result = await fetchMyLogsForTv(tmdbId);
			if (result.error || !Array.isArray(result.data)) {
				applyDiaryResult(null, true);
				return;
			}
			applyDiaryResult(result.data, false);
		} catch {
			applyDiaryResult(null, true);
		}
	}, [applyDiaryResult, tmdbId]);

	const retrySeasons = useCallback(() => {
		void loadCatalogue(new AbortController().signal);
	}, [loadCatalogue]);

	const close = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			close();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [close, open]);

	useEffect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [open]);

	const selectSeason = useCallback((seasonNumber: number) => {
		setActiveSeason(seasonNumber);
		skipScrollSyncRef.current = true;
		groupRefs.current.get(seasonNumber)?.scrollIntoView({
			block: "start",
			behavior: "smooth",
		});
		window.setTimeout(() => {
			skipScrollSyncRef.current = false;
		}, 400);
	}, []);

	// Scrolling a season group into view updates the large poster.
	useEffect(() => {
		if (!open || seasons.length === 0) return;
		const root = listRef.current;
		if (!root) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (skipScrollSyncRef.current) return;
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
				const raw = visible?.target.getAttribute("data-season-number");
				if (raw == null) return;
				const next = Number(raw);
				if (!Number.isFinite(next)) return;
				setActiveSeason(next);
			},
			{ root, threshold: 0.45 },
		);
		for (const node of groupRefs.current.values()) {
			observer.observe(node);
		}
		return () => observer.disconnect();
	}, [open, seasons]);

	const openLatestLog = useCallback(
		(latestLogId: string) => {
			const row = logRows.find((entry) => entry.log.id === latestLogId);
			if (!row) return;
			const payload = diaryLogToQuickLogOpenPayload(row, () => {
				void refetchDiary();
			});
			if (payload) openQuickLog(payload);
		},
		[logRows, openQuickLog, refetchDiary],
	);

	if (!mounted || !open) return null;

	const portal = (
		<div className={cn("fixed inset-0 z-[250]", quickLogOpen && "z-[50]")}>
			{/* Scrim is a real button so Escape-or-click close stays keyboard-reachable. */}
			<button
				type="button"
				aria-label="Close"
				className={cn(APP_MODAL_OVERLAY_CLASS, "px-4 py-6")}
				onClick={close}
			/>
			<div className="pointer-events-none fixed inset-0 z-[250] grid min-h-[100dvh] place-items-end overflow-y-auto px-4 py-6 md:place-items-center">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="pointer-events-auto relative flex max-h-[min(88svh,52rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-card"
				>
					<button
						type="button"
						aria-label="Close"
						className={cn(
							"absolute top-3 right-3 z-10 inline-flex min-h-11 min-w-11 cursor-pointer select-none items-center justify-center rounded-full bg-background text-muted-foreground",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
						onClick={close}
					>
						<X className="size-4" aria-hidden />
					</button>

					<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6 pt-14 sm:flex-row">
						<aside className="flex w-full shrink-0 flex-col gap-3 sm:w-44">
							<div
								data-diary-flight-slot
								className="relative aspect-2/3 w-full overflow-hidden rounded-[1.25rem] bg-background"
							>
								{largePosterSrc ? (
									<Image
										src={largePosterSrc}
										alt=""
										fill
										sizes="(max-width:640px) 80vw, 176px"
										className="object-cover"
										unoptimized={isTmdbCdnUrl(largePosterSrc)}
										priority
									/>
								) : null}
							</div>
							{seriesLabel ? (
								<p className="text-pretty font-medium text-foreground text-sm">
									{seriesLabel}
								</p>
							) : null}
							<div className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden">
								{seasons.map((season) => (
									<SeasonPosterThumb
										key={season.id}
										src={seasonPosterSrc(season.poster_path, posterPath)}
										label={season.name || `Season ${season.season_number}`}
										active={season.season_number === activeSeason}
										onSelect={() => selectSeason(season.season_number)}
									/>
								))}
							</div>
						</aside>

						<div
							ref={listRef}
							className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						>
							<h2
								id={titleId}
								className="text-balance font-semibold text-foreground text-lg tracking-tight"
							>
								{title}
							</h2>

							{seasonsError ? (
								<div className="flex flex-col items-start gap-3">
									<p className="text-muted-foreground text-sm">
										Couldn’t load episodes
									</p>
									<button
										type="button"
										className="inline-flex min-h-11 cursor-pointer select-none items-center rounded-full bg-background px-4 font-medium text-sm"
										onClick={retrySeasons}
									>
										Try again
									</button>
								</div>
							) : null}

							{diaryError ? (
								<div className="flex flex-col items-start gap-3">
									<p className="text-muted-foreground text-sm">
										Couldn’t load diary entries
									</p>
									<button
										type="button"
										className="inline-flex min-h-11 cursor-pointer select-none items-center rounded-full bg-background px-4 font-medium text-sm"
										onClick={() => {
											void refetchDiary();
										}}
									>
										Try again
									</button>
								</div>
							) : null}

							{seasonsLoading && !seasonsError
								? (["left", "right"] as const).map((slot) => (
										<div
											key={`season-bone-${slot}`}
											className="rounded-[1.25rem] bg-background p-4"
										>
											<div className="flex flex-wrap gap-2">
												{(["a", "b", "c", "d", "e", "f"] as const).map(
													(pillSlot) => (
														<span
															key={`bone-${slot}-${pillSlot}`}
															className="h-11 w-11 animate-pulse rounded-full bg-background"
														/>
													),
												)}
											</div>
										</div>
									))
								: null}

							{seasons.map((season) => {
								const seasonNumber = season.season_number;
								const episodes = episodesBySeason[seasonNumber];
								const failed = seasonFailed[seasonNumber] === true;
								const label = seasonLogLabel(seasonNumber, episodeLogs);
								const name = season.name || `Season ${seasonNumber}`;
								return (
									<section
										key={season.id}
										ref={(node) => {
											if (node) groupRefs.current.set(seasonNumber, node);
											else groupRefs.current.delete(seasonNumber);
										}}
										data-season-number={seasonNumber}
										className="rounded-[1.25rem] bg-background p-4"
									>
										<header className="mb-3 text-pretty font-medium text-sm">
											{name}
											{label ? (
												<span className="text-muted-foreground">
													{" "}
													· {label}
												</span>
											) : null}
										</header>
										{failed ? (
											<button
												type="button"
												className="inline-flex min-h-11 cursor-pointer select-none items-center rounded-full bg-card px-4 font-medium text-sm"
												onClick={() => {
													void loadSeasonEpisodes(seasonNumber);
												}}
											>
												Try again
											</button>
										) : episodes == null ? (
											<div className="flex flex-wrap gap-2">
												{loadingPillKeys(
													seasonNumber,
													season.episode_count,
												).map((pillKey) => (
													<span
														key={pillKey}
														className="h-11 w-11 animate-pulse rounded-full bg-background"
													/>
												))}
											</div>
										) : (
											<div className="flex flex-wrap gap-2">
												{episodes.map((episode) => (
													<EpisodePill
														key={episode.id}
														episodeNumber={episode.episode_number}
														pill={pillForEpisode(
															{
																seasonNumber,
																episodeNumber: episode.episode_number,
															},
															episodeLogs,
														)}
														onOpenLog={openLatestLog}
													/>
												))}
											</div>
										)}
									</section>
								);
							})}

							{!seasonsError && seasons.length > 0 ? (
								<div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 pb-2">
									<LegendSwatch label="Not logged">—</LegendSwatch>
									<LegendSwatch label="Watched, no rating">·</LegendSwatch>
									<LegendSwatch
										label="0"
										background={ratedPillBackground(0)}
										textClass={ratedPillTextClass(0)}
									>
										0
									</LegendSwatch>
									<LegendSwatch
										label="5"
										background={ratedPillBackground(5)}
										textClass={ratedPillTextClass(5)}
									>
										5
									</LegendSwatch>
									<LegendSwatch
										label="10"
										background={ratedPillBackground(10)}
										textClass={ratedPillTextClass(10)}
									>
										10
									</LegendSwatch>
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	);

	return createPortal(portal, document.body);
}
