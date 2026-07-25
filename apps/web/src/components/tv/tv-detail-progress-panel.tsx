"use client";

import { Checkbox } from "@still/ui/components/checkbox";
import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import IconPlayRotateAnticlockwise from "@still/ui/icons/play-rotate-anticlockwise";
import { cn } from "@still/ui/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { useTvDetailWatchContext } from "@/components/tv/tv-detail-watch-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatTodayYmd, ymdToLocalDate } from "@/lib/log-watched-date";
import {
	fetchTvSeasonDetail,
	fetchTvSeasons,
	postLog,
} from "@/lib/still-api-fetch";
import { TV_DETAIL_SECTION } from "@/lib/tv-detail-sections";
import {
	countTvLogsInScope,
	findLatestTvLogInScope,
} from "@/lib/tv-log-scope-prior";
import { formatTvNextEpisodeLabel } from "@/lib/tv-watch-format";
import {
	TV_PROGRESS_MODE_LABELS,
	TV_WATCH_STATUS_LABELS,
	type TvEpisodeSummary,
	type TvProgressMode,
	type TvSeasonSummary,
	type TvWatchStatus,
} from "@/lib/tv-watch-types";

/** Raised tiles on the detail card — no borders, rings, or decorative shadows. */
const PROGRESS_TILE_CLASS = "rounded-2xl bg-background";

/** Shared content width inside the About section column. */
const PROGRESS_CONTENT_CLASS = "mx-auto flex w-full max-w-2xl flex-col gap-5";

/** Secondary diary controls on season rows — mirrors TV hero (rewatch + pencil). */
const SEASON_DIARY_ACTION_CIRCLE_CLASS = cn(
	"inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-foreground",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-45",
);

const SEASON_DIARY_FALLBACK_PILL_CLASS = cn(
	"inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-card px-4 py-2 font-medium text-foreground text-sm",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const MARK_SEASON_COMPLETE_CLASS = cn(
	"inline-flex min-h-10 min-w-[9.5rem] shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 font-semibold text-background text-sm",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-50",
);

const START_WATCHING_CLASS = cn(
	"inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-6 py-3 font-semibold text-background text-sm",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-50",
);

function countWatchedInSeason(
	watchedKeySet: ReadonlySet<string>,
	seasonNumber: number,
) {
	let count = 0;
	for (const key of watchedKeySet) {
		if (key.startsWith(`${seasonNumber}:`)) count += 1;
	}
	return count;
}

function buildProgressSubtitle(input: {
	hasWatch: boolean;
	status: TvWatchStatus | null;
	progressMode: TvProgressMode | null;
}) {
	if (!input.hasWatch) {
		return "Track seasons and episodes as you watch — separate from your diary.";
	}
	if (input.status === "paused" || input.status === "abandoned") {
		return `${TV_WATCH_STATUS_LABELS[input.status]} — set status back to Watching in the hero to keep checking episodes off.`;
	}
	if (input.status === "finished") {
		return "Series marked finished — your episode checklist stays here for reference.";
	}
	if (input.progressMode === "episode") {
		return "Check off episodes as you go. Expand a season to see every episode.";
	}
	return "Mark whole seasons when you binge them, or log season diary entries.";
}

/**
 * Season vs episode progress UI on the About tab — summary meter, mode toggle, and rows.
 */
export function TvDetailProgressPanel({ tvId }: { tvId: number }) {
	const { tvWatch, userState } = useTvDetailWatchContext();
	const {
		hydrated,
		watch,
		watchedKeySet,
		nextEpisode,
		isActivelyTracking,
		busy,
		startWatching,
		setProgressMode,
		toggleEpisodeWatched,
		markSeasonComplete,
	} = tvWatch;
	const { myLogs, handleOpenQuickLog, handleEditLog, refreshUserState } =
		userState;

	const [completingSeason, setCompletingSeason] = useState<number | null>(null);

	const [seasons, setSeasons] = useState<TvSeasonSummary[]>([]);
	const [seasonsLoading, setSeasonsLoading] = useState(false);
	const [openSeason, setOpenSeason] = useState<number | null>(null);
	const [episodesBySeason, setEpisodesBySeason] = useState<
		Record<number, TvEpisodeSummary[]>
	>({});
	const [episodesLoading, setEpisodesLoading] = useState<number | null>(null);

	const loadSeasons = useCallback(async () => {
		setSeasonsLoading(true);
		try {
			const res = await fetchTvSeasons(tvId);
			setSeasons(res.data?.seasons ?? []);
		} finally {
			setSeasonsLoading(false);
		}
	}, [tvId]);

	useEffect(() => {
		if (!watch) return;
		void loadSeasons();
	}, [watch, loadSeasons]);

	const totalEpisodes = useMemo(
		() => seasons.reduce((sum, season) => sum + season.episode_count, 0),
		[seasons],
	);
	const watchedEpisodeCount = watchedKeySet.size;
	const progressPercent =
		totalEpisodes > 0
			? Math.min(100, Math.round((watchedEpisodeCount / totalEpisodes) * 100))
			: 0;
	const continueLabel = formatTvNextEpisodeLabel(nextEpisode);

	async function loadEpisodesForSeason(seasonNumber: number) {
		if (episodesBySeason[seasonNumber]) return;
		setEpisodesLoading(seasonNumber);
		try {
			const res = await fetchTvSeasonDetail(tvId, seasonNumber);
			const eps = res.data?.season?.episodes ?? [];
			setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: eps }));
		} finally {
			setEpisodesLoading(null);
		}
	}

	function handleToggleSeasonAccordion(seasonNumber: number) {
		const next = openSeason === seasonNumber ? null : seasonNumber;
		setOpenSeason(next);
		if (next != null) void loadEpisodesForSeason(seasonNumber);
	}

	async function handleMarkSeasonComplete(seasonNumber: number) {
		if (!watch) return;
		setCompletingSeason(seasonNumber);
		const seasonLabel =
			seasons.find((s) => s.season_number === seasonNumber)?.name ??
			`Season ${seasonNumber}`;
		const seasonScope = {
			logScope: "season" as const,
			seasonNumber,
		};
		try {
			const updated = await markSeasonComplete(seasonNumber);
			if (!updated) return;

			const hadSeasonLog = countTvLogsInScope(myLogs, seasonScope) > 0;
			if (!hadSeasonLog) {
				const diaryResult = await postLog({
					tvId,
					logScope: "season",
					seasonNumber,
					watchedAt: ymdToLocalDate(formatTodayYmd()).toISOString(),
					watchVenue: "streaming",
					rewatch: false,
				});
				if (!diaryResult.ok) {
					toast.success(`${seasonLabel} marked complete`, {
						description: "Couldn't add a diary entry.",
						action: {
							label: "Try again",
							onClick: () =>
								handleOpenQuickLog({
									logScope: "season",
									seasonNumber,
								}),
						},
					});
					return;
				}
				await refreshUserState();
				toast.success(`${seasonLabel} marked complete`, {
					description: "Added to your diary.",
				});
				return;
			}

			toast.success(`${seasonLabel} marked complete`);
		} finally {
			setCompletingSeason(null);
		}
	}

	if (!hydrated) {
		return (
			<MovieDetailBodySection
				id={TV_DETAIL_SECTION.progress}
				title="Your progress"
				subtitle="Track seasons and episodes as you watch."
			>
				<div className={PROGRESS_CONTENT_CLASS}>
					<div
						className={cn(
							PROGRESS_TILE_CLASS,
							"flex justify-center px-6 py-10",
						)}
					>
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				</div>
			</MovieDetailBodySection>
		);
	}

	if (!watch) {
		return (
			<MovieDetailBodySection
				id={TV_DETAIL_SECTION.progress}
				title="Your progress"
				subtitle={buildProgressSubtitle({
					hasWatch: false,
					status: null,
					progressMode: null,
				})}
			>
				<div className={PROGRESS_CONTENT_CLASS}>
					<div
						className={cn(
							PROGRESS_TILE_CLASS,
							"flex flex-col items-center gap-4 px-6 py-8 text-center sm:px-8 sm:py-10",
						)}
					>
						<p className="max-w-sm text-balance font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
							Start watching to check off episodes, mark seasons complete, and
							see what&apos;s next in the series.
						</p>
						<DetailMotionButton
							type="button"
							className={START_WATCHING_CLASS}
							onClick={() => void startWatching()}
							disabled={busy === "start"}
						>
							{busy === "start" ? "Starting…" : "Start watching"}
						</DetailMotionButton>
					</div>
				</div>
			</MovieDetailBodySection>
		);
	}

	const progressMode = watch.progressMode;
	const statusLabel = TV_WATCH_STATUS_LABELS[watch.status];

	return (
		<MovieDetailBodySection
			id={TV_DETAIL_SECTION.progress}
			title="Your progress"
			subtitle={buildProgressSubtitle({
				hasWatch: true,
				status: watch.status,
				progressMode,
			})}
		>
			<div className={PROGRESS_CONTENT_CLASS}>
				<TvProgressSummaryCard
					statusLabel={statusLabel}
					watchedEpisodeCount={watchedEpisodeCount}
					totalEpisodes={totalEpisodes}
					progressPercent={progressPercent}
					continueLabel={
						isActivelyTracking && continueLabel ? continueLabel : null
					}
					seasonCount={seasons.length}
				/>

				<div className="flex justify-center">
					<SegmentedPillToolbar
						layoutId="tv-detail-progress-mode-pill"
						aria-label="Progress mode"
						value={progressMode}
						onChange={(mode) => void setProgressMode(mode)}
						disabled={busy === "mode"}
						options={(
							["season", "episode"] as const satisfies TvProgressMode[]
						).map((mode) => ({
							id: mode,
							label: TV_PROGRESS_MODE_LABELS[mode],
						}))}
					/>
				</div>

				{seasonsLoading ? (
					<div
						className={cn(PROGRESS_TILE_CLASS, "flex justify-center px-6 py-8")}
					>
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : null}

				{!seasonsLoading && progressMode === "season" ? (
					<ul className="flex flex-col gap-3">
						{seasons.map((season) => {
							const sn = season.season_number;
							const total = season.episode_count;
							const watchedInSeason = countWatchedInSeason(watchedKeySet, sn);
							const complete = total > 0 && watchedInSeason >= total;
							const seasonScope = {
								logScope: "season" as const,
								seasonNumber: sn,
							};
							const seasonLogCount = countTvLogsInScope(myLogs, seasonScope);
							const latestSeasonLog = findLatestTvLogInScope(
								myLogs,
								seasonScope,
							);
							const seasonName = season.name || `Season ${sn}`;

							return (
								<li key={sn}>
									<TvSeasonMilestoneRow
										seasonName={seasonName}
										watchedInSeason={watchedInSeason}
										totalEpisodes={total}
										complete={complete}
										completing={completingSeason === sn}
										markDisabled={busy === "season"}
										onMarkComplete={() => void handleMarkSeasonComplete(sn)}
										seasonLogCount={seasonLogCount}
										latestSeasonLog={latestSeasonLog}
										onRewatch={() =>
											handleOpenQuickLog(
												{
													logScope: "season",
													seasonNumber: sn,
												},
												{ asRewatch: true },
											)
										}
										onEditLog={() => {
											if (latestSeasonLog) handleEditLog(latestSeasonLog);
										}}
										onLogToDiary={() =>
											handleOpenQuickLog({
												logScope: "season",
												seasonNumber: sn,
											})
										}
									/>
								</li>
							);
						})}
					</ul>
				) : null}

				{!seasonsLoading && progressMode === "episode" ? (
					<div className="flex flex-col gap-3">
						{seasons.map((season) => {
							const sn = season.season_number;
							const isOpen = openSeason === sn;
							const eps = episodesBySeason[sn];
							const watchedInSeason = countWatchedInSeason(watchedKeySet, sn);
							const total = season.episode_count;

							return (
								<TvSeasonEpisodeAccordion
									key={sn}
									seasonName={season.name || `Season ${sn}`}
									isOpen={isOpen}
									watchedInSeason={watchedInSeason}
									totalEpisodes={total}
									loadingEpisodes={episodesLoading === sn && !eps}
									episodes={eps ?? []}
									tvId={tvId}
									watchedKeySet={watchedKeySet}
									toggleDisabled={busy === "episode"}
									onToggle={() => handleToggleSeasonAccordion(sn)}
									onToggleEpisode={(seasonNumber, episodeNumber, checked) => {
										void toggleEpisodeWatched(
											seasonNumber,
											episodeNumber,
											checked,
										);
									}}
								/>
							);
						})}
					</div>
				) : null}
			</div>
		</MovieDetailBodySection>
	);
}

function TvProgressSummaryCard({
	statusLabel,
	watchedEpisodeCount,
	totalEpisodes,
	progressPercent,
	continueLabel,
	seasonCount,
}: {
	statusLabel: string;
	watchedEpisodeCount: number;
	totalEpisodes: number;
	progressPercent: number;
	continueLabel: string | null;
	seasonCount: number;
}) {
	const hasTotals = totalEpisodes > 0;

	return (
		<div className={cn(PROGRESS_TILE_CLASS, "px-4 py-4 sm:px-5 sm:py-5")}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 text-left">
					<p className="font-medium text-foreground text-sm">{statusLabel}</p>
					<p className="mt-1 font-semibold text-foreground text-xl tabular-nums tracking-tight sm:text-2xl">
						{hasTotals ? (
							<>
								{watchedEpisodeCount}
								<span className="font-medium text-muted-foreground">
									{" "}
									/ {totalEpisodes}
								</span>
							</>
						) : (
							watchedEpisodeCount
						)}{" "}
						<span className="font-medium text-base text-muted-foreground sm:text-lg">
							episodes watched
						</span>
					</p>
				</div>
				{hasTotals ? (
					<p className="shrink-0 font-semibold text-foreground text-lg tabular-nums">
						{progressPercent}%
					</p>
				) : null}
			</div>

			{hasTotals ? (
				<TvProgressMeter
					className="mt-4"
					value={watchedEpisodeCount}
					max={totalEpisodes}
					label={`${watchedEpisodeCount} of ${totalEpisodes} episodes watched`}
				/>
			) : null}

			{continueLabel ? (
				<p className="mt-4 text-balance text-left font-editorial text-muted-foreground text-sm leading-relaxed">
					{continueLabel}
				</p>
			) : null}

			{seasonCount > 0 ? (
				<p className="mt-3 text-left text-muted-foreground text-xs tabular-nums">
					{seasonCount} {seasonCount === 1 ? "season" : "seasons"} in this show
				</p>
			) : null}
		</div>
	);
}

function TvProgressMeter({
	value,
	max,
	label,
	className,
}: {
	value: number;
	max: number;
	label: string;
	className?: string;
}) {
	const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

	return (
		<div className={className}>
			<div
				className="h-1.5 overflow-hidden rounded-full bg-card"
				role="progressbar"
				aria-valuenow={value}
				aria-valuemin={0}
				aria-valuemax={max}
				aria-label={label}
			>
				<div
					className="h-full rounded-full bg-foreground transition-[width] duration-200 ease-out"
					style={{ width: `${percent}%` }}
				/>
			</div>
		</div>
	);
}

function TvSeasonMilestoneRow({
	seasonName,
	watchedInSeason,
	totalEpisodes,
	complete,
	completing,
	markDisabled,
	onMarkComplete,
	seasonLogCount,
	latestSeasonLog,
	onRewatch,
	onEditLog,
	onLogToDiary,
}: {
	seasonName: string;
	watchedInSeason: number;
	totalEpisodes: number;
	complete: boolean;
	completing: boolean;
	markDisabled: boolean;
	onMarkComplete: () => void;
	seasonLogCount: number;
	latestSeasonLog: ReturnType<typeof findLatestTvLogInScope>;
	onRewatch: () => void;
	onEditLog: () => void;
	onLogToDiary: () => void;
}) {
	return (
		<div
			className={cn(
				PROGRESS_TILE_CLASS,
				"flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5",
			)}
		>
			<div className="min-w-0 flex-1 text-left">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<p className="font-medium text-base text-foreground">{seasonName}</p>
					{complete ? (
						<span className="rounded-full bg-card px-2 py-0.5 font-medium text-foreground text-xs">
							Complete
						</span>
					) : null}
				</div>
				<p className="mt-1 text-muted-foreground text-sm tabular-nums">
					{watchedInSeason} / {totalEpisodes} episodes
				</p>
				{totalEpisodes > 0 ? (
					<TvProgressMeter
						className="mt-3 max-w-md"
						value={watchedInSeason}
						max={totalEpisodes}
						label={`${seasonName}: ${watchedInSeason} of ${totalEpisodes} episodes watched`}
					/>
				) : null}
			</div>

			<div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
				{complete ? (
					seasonLogCount > 0 && latestSeasonLog ? (
						<>
							<DetailMotionButton
								type="button"
								className={SEASON_DIARY_ACTION_CIRCLE_CLASS}
								onClick={onRewatch}
								aria-label={
									seasonLogCount > 1
										? `Log ${seasonName} again (${seasonLogCount} season logs)`
										: `Log ${seasonName} again`
								}
							>
								<span className="relative inline-flex">
									<IconPlayRotateAnticlockwise
										size="20px"
										className="shrink-0 opacity-90"
										aria-hidden
									/>
									{seasonLogCount > 1 ? (
										<span
											className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-foreground font-semibold text-[10px] text-background tabular-nums"
											aria-hidden
										>
											{seasonLogCount}
										</span>
									) : null}
								</span>
							</DetailMotionButton>
							<DetailMotionButton
								type="button"
								className={SEASON_DIARY_ACTION_CIRCLE_CLASS}
								onClick={onEditLog}
								aria-label={`Edit your ${seasonName} diary log`}
							>
								<IconPen2Fill
									size="20px"
									className="shrink-0 opacity-90"
									aria-hidden
								/>
							</DetailMotionButton>
						</>
					) : (
						<button
							type="button"
							className={SEASON_DIARY_FALLBACK_PILL_CLASS}
							onClick={onLogToDiary}
						>
							Log to diary
						</button>
					)
				) : (
					<DetailMotionButton
						type="button"
						className={MARK_SEASON_COMPLETE_CLASS}
						disabled={markDisabled || completing}
						onClick={onMarkComplete}
					>
						{completing ? (
							<>
								<Loader2 className="size-4 animate-spin" aria-hidden />
								Marking…
							</>
						) : (
							"Mark season complete"
						)}
					</DetailMotionButton>
				)}
			</div>
		</div>
	);
}

function TvSeasonEpisodeAccordion({
	seasonName,
	isOpen,
	watchedInSeason,
	totalEpisodes,
	loadingEpisodes,
	episodes,
	tvId,
	watchedKeySet,
	toggleDisabled,
	onToggle,
	onToggleEpisode,
}: {
	seasonName: string;
	isOpen: boolean;
	watchedInSeason: number;
	totalEpisodes: number;
	loadingEpisodes: boolean;
	episodes: TvEpisodeSummary[];
	tvId: number;
	watchedKeySet: ReadonlySet<string>;
	toggleDisabled: boolean;
	onToggle: () => void;
	onToggleEpisode: (
		seasonNumber: number,
		episodeNumber: number,
		checked: boolean,
	) => void;
}) {
	return (
		<div className={cn(PROGRESS_TILE_CLASS, "overflow-hidden")}>
			<button
				type="button"
				className={cn(
					"flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
				)}
				aria-expanded={isOpen}
				onClick={onToggle}
			>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span className="font-medium text-base text-foreground">
							{seasonName}
						</span>
						<span className="rounded-full bg-card px-2 py-0.5 font-medium text-muted-foreground text-xs tabular-nums">
							{watchedInSeason}/{totalEpisodes}
						</span>
					</div>
					{totalEpisodes > 0 ? (
						<TvProgressMeter
							className="mt-3 max-w-md"
							value={watchedInSeason}
							max={totalEpisodes}
							label={`${seasonName}: ${watchedInSeason} of ${totalEpisodes} episodes watched`}
						/>
					) : null}
				</div>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
						isOpen && "rotate-180",
					)}
					aria-hidden
				/>
			</button>

			{isOpen ? (
				<div className="px-3 pb-3 sm:px-4 sm:pb-4">
					{loadingEpisodes ? (
						<div className="flex justify-center py-4">
							<Loader2 className="size-4 animate-spin text-muted-foreground" />
						</div>
					) : null}
					<ul className="flex flex-col gap-1">
						{episodes.map((ep) => {
							const key = `${ep.season_number}:${ep.episode_number}`;
							const checked = watchedKeySet.has(key);
							return (
								<li key={key}>
									<div
										className={cn(
											"flex min-h-11 items-center gap-3 rounded-xl px-2 py-2",
											"[@media(hover:hover)]:hover:bg-card/80",
										)}
									>
										<Checkbox
											id={`tv-ep-${tvId}-${key}`}
											checked={checked}
											disabled={toggleDisabled}
											onCheckedChange={(value) => {
												onToggleEpisode(
													ep.season_number,
													ep.episode_number,
													value === true,
												);
											}}
										/>
										<label
											htmlFor={`tv-ep-${tvId}-${key}`}
											className="flex min-w-0 flex-1 cursor-pointer select-none flex-col gap-0.5"
										>
											<span className="font-medium text-foreground text-sm tabular-nums">
												E{ep.episode_number}
												{ep.name ? ` · ${ep.name}` : ""}
											</span>
											{ep.air_date ? (
												<span className="text-muted-foreground text-xs">
													{ep.air_date}
												</span>
											) : null}
										</label>
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			) : null}
		</div>
	);
}
