"use client";

import { Checkbox } from "@still/ui/components/checkbox";
import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import IconPlayRotateAnticlockwise from "@still/ui/icons/play-rotate-anticlockwise";
import { cn } from "@still/ui/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import {
	TV_PROGRESS_MODE_LABELS,
	TV_WATCH_STATUS_LABELS,
	type TvEpisodeSummary,
	type TvProgressMode,
	type TvSeasonSummary,
} from "@/lib/tv-watch-types";

/** Secondary diary controls on season rows — mirrors TV hero (rewatch + pencil). */
const SEASON_DIARY_ACTION_CIRCLE_CLASS = cn(
	"inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
	"disabled:pointer-events-none disabled:opacity-45",
);

const SEASON_DIARY_FALLBACK_PILL_CLASS = cn(
	"inline-flex shrink-0 items-center justify-center rounded-full bg-background px-4 py-2 font-medium text-foreground text-sm",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
);

/**
 * Season vs episode progress UI on the About tab — checkboxes and season milestones.
 */
export function TvDetailProgressPanel({ tvId }: { tvId: number }) {
	const { tvWatch, userState } = useTvDetailWatchContext();
	const {
		hydrated,
		watch,
		watchedKeySet,
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
				<div className="flex justify-center py-8">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			</MovieDetailBodySection>
		);
	}

	if (!watch) {
		return (
			<MovieDetailBodySection
				id={TV_DETAIL_SECTION.progress}
				title="Your progress"
				subtitle="Track seasons and episodes as you watch — separate from your diary."
			>
				<div className="flex flex-col items-center gap-4 py-4">
					<p className="max-w-md text-balance text-center text-muted-foreground text-sm">
						Start watching to check off episodes and see what&apos;s next.
					</p>
					<button
						type="button"
						className="inline-flex rounded-full bg-foreground px-5 py-3 font-semibold text-background text-sm"
						onClick={() => void startWatching()}
						disabled={busy === "start"}
					>
						{busy === "start" ? "Starting…" : "Start watching"}
					</button>
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
			subtitle={`${statusLabel} · ${progressMode === "episode" ? "Episode checklist" : "Season milestones"}`}
		>
			<div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
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

				{seasonsLoading ? (
					<div className="flex justify-center py-6">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : null}

				{!seasonsLoading && progressMode === "season" ? (
					<ul className="divide-y divide-foreground/5 rounded-2xl bg-card shadow-[var(--shadow-raised)]">
						{seasons.map((season) => {
							const sn = season.season_number;
							const total = season.episode_count;
							const watchedInSeason = [...watchedKeySet].filter((k) =>
								k.startsWith(`${sn}:`),
							).length;
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
								<li
									key={sn}
									className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"
								>
									<div className="text-left">
										<p className="font-medium text-foreground text-sm">
											{seasonName}
										</p>
										<p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
											{watchedInSeason} / {total} episodes
											{complete ? " · Complete" : ""}
										</p>
									</div>
									{complete ? (
										seasonLogCount > 0 && latestSeasonLog ? (
											<div className="flex shrink-0 items-center gap-2">
												<DetailMotionButton
													type="button"
													className={SEASON_DIARY_ACTION_CIRCLE_CLASS}
													onClick={() =>
														handleOpenQuickLog(
															{
																logScope: "season",
																seasonNumber: sn,
															},
															{ asRewatch: true },
														)
													}
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
													onClick={() => handleEditLog(latestSeasonLog)}
													aria-label={`Edit your ${seasonName} diary log`}
												>
													<IconPen2Fill
														size="20px"
														className="shrink-0 opacity-90"
														aria-hidden
													/>
												</DetailMotionButton>
											</div>
										) : (
											<button
												type="button"
												className={SEASON_DIARY_FALLBACK_PILL_CLASS}
												onClick={() =>
													handleOpenQuickLog({
														logScope: "season",
														seasonNumber: sn,
													})
												}
											>
												Log to diary
											</button>
										)
									) : (
										<button
											type="button"
											className={cn(
												"inline-flex min-w-[9.5rem] items-center justify-center gap-2 rounded-full bg-background px-4 py-2 font-medium text-foreground text-sm disabled:opacity-50",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
											)}
											disabled={busy === "season" || completingSeason === sn}
											onClick={() => void handleMarkSeasonComplete(sn)}
										>
											{completingSeason === sn ? (
												<>
													<Loader2
														className="size-4 animate-spin"
														aria-hidden
													/>
													Marking…
												</>
											) : (
												"Mark season complete"
											)}
										</button>
									)}
								</li>
							);
						})}
					</ul>
				) : null}

				{!seasonsLoading && progressMode === "episode" ? (
					<div className="flex flex-col gap-2">
						{seasons.map((season) => {
							const sn = season.season_number;
							const isOpen = openSeason === sn;
							const eps = episodesBySeason[sn];
							return (
								<div
									key={sn}
									className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-raised)]"
								>
									<button
										type="button"
										className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
										aria-expanded={isOpen}
										onClick={() => handleToggleSeasonAccordion(sn)}
									>
										<span className="font-medium text-foreground text-sm">
											{season.name || `Season ${sn}`}
										</span>
										<ChevronDown
											className={cn(
												"size-4 shrink-0 text-muted-foreground transition-transform duration-200",
												isOpen && "rotate-180",
											)}
											aria-hidden
										/>
									</button>
									{isOpen ? (
										<div className="border-foreground/5 border-t px-2 pb-3 sm:px-3">
											{episodesLoading === sn && !eps ? (
												<div className="flex justify-center py-4">
													<Loader2 className="size-4 animate-spin text-muted-foreground" />
												</div>
											) : null}
											<ul className="flex flex-col">
												{(eps ?? []).map((ep) => {
													const key = `${ep.season_number}:${ep.episode_number}`;
													const checked = watchedKeySet.has(key);
													return (
														<li
															key={key}
															className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 hover:bg-foreground/[0.04]"
														>
															<Checkbox
																id={`tv-ep-${tvId}-${key}`}
																checked={checked}
																disabled={busy === "episode"}
																onCheckedChange={(value) => {
																	void toggleEpisodeWatched(
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
														</li>
													);
												})}
											</ul>
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				) : null}

				{watch.status === "finished" ? (
					<p className="text-center text-muted-foreground text-sm">
						You marked this show finished. Log a series review in your diary
						when you&apos;re ready.
					</p>
				) : null}

				{watch.status === "paused" || watch.status === "abandoned" ? (
					<p className="text-center text-muted-foreground text-sm">
						Status: {statusLabel}. Set status back to Watching in the hero to
						continue tracking episodes.
					</p>
				) : null}
			</div>
		</MovieDetailBodySection>
	);
}
