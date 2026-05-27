"use client";

import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import IconPlayRotateAnticlockwise from "@still/ui/icons/play-rotate-anticlockwise";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { AddToListControl } from "@/components/list/add-to-list-control";
import { DetailWatchlistButton } from "@/components/movie/detail-watchlist-button";
import { useTvDetailWatchContext } from "@/components/tv/tv-detail-watch-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	DETAIL_MOTION_PRESSABLE_CLASS,
	DETAIL_MOTION_SWAP_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";
import { countTvLogsInScope } from "@/lib/tv-log-scope-prior";
import { formatTvNextEpisodeLabel } from "@/lib/tv-watch-format";
import {
	TV_WATCH_STATUS_LABELS,
	type TvWatchStatus,
} from "@/lib/tv-watch-types";

const STATUS_OPTIONS: TvWatchStatus[] = [
	"watching",
	"paused",
	"abandoned",
	"finished",
	"rewatching",
];

/**
 * Hero block for TV — watchlist, start watching / mark next, diary log, status chips,
 * and continue line. Uses `TvDetailWatchProvider` for a single progress + diary fetch.
 */
export function TvDetailPrimaryActions() {
	const { tvId, title, tvWatch, userState } = useTvDetailWatchContext();
	const {
		hydrated: watchHydrated,
		watch,
		nextEpisode,
		busy: watchBusy,
		isActivelyTracking,
		startWatching,
		setStatus,
		markNextEpisode,
	} = tvWatch;

	const {
		hydrated: logHydrated,
		myLogs,
		inWatchlist,
		busy: logBusy,
		latestLog,
		handleOpenQuickLog,
		handleEditLatestLog,
		toggleWatchlist,
	} = userState;

	const hydrated = watchHydrated && logHydrated;
	const hasLogged = myLogs.length > 0;
	/** Whole-series diary count — badge only; season/episode logs do not inflate it. */
	const showLogCount = countTvLogsInScope(myLogs, { logScope: "show" });
	const hasWatch = watch != null;
	const motionProps = useDetailActionMotion();
	const continueLabel = formatTvNextEpisodeLabel(nextEpisode);

	const showWatchlistSlot = !hasLogged && !hasWatch;
	const episodeModeActive = watch?.progressMode === "episode";
	const showMarkNext =
		hasWatch && isActivelyTracking && episodeModeActive && nextEpisode != null;

	/** Secondary diary control — only when primary is not already “Log to diary”. */
	const showDiarySecondary = hasLogged ? true : hasWatch && showMarkNext;

	const circle = cn(
		"inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-background text-foreground",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
		"disabled:pointer-events-none disabled:opacity-40",
	);

	const primaryPill = cn(
		"inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-5 py-3 font-semibold text-background text-sm sm:text-base",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
		"disabled:pointer-events-none disabled:opacity-45",
	);

	const primaryKey = !hydrated
		? "loading"
		: showMarkNext
			? "mark-next"
			: !hasWatch && !hasLogged
				? "start-watching"
				: hasLogged
					? `watch-again-${showLogCount}`
					: "log-watched";

	function handlePrimaryClick() {
		if (showMarkNext) {
			void markNextEpisode();
			return;
		}
		if (!hasWatch && !hasLogged) {
			void startWatching();
			return;
		}
		handleOpenQuickLog(undefined, { asRewatch: hasLogged });
	}

	const primaryLabel = showMarkNext
		? "Mark next episode"
		: !hasWatch && !hasLogged
			? "Start watching"
			: hasLogged
				? null
				: "Log to diary";

	return (
		<div className="flex w-full max-w-lg flex-col items-center gap-4">
			{hasWatch && continueLabel && isActivelyTracking ? (
				<p className="text-balance text-center text-muted-foreground text-sm">
					{continueLabel}
				</p>
			) : null}

			{hasWatch ? (
				<SegmentedPillToolbar
					layoutId="tv-detail-watch-status-pill"
					aria-label="Watching status"
					value={watch.status}
					onChange={(status) => void setStatus(status)}
					disabled={watchBusy === "status"}
					compact
					options={STATUS_OPTIONS.map((status) => ({
						id: status,
						label: TV_WATCH_STATUS_LABELS[status],
					}))}
				/>
			) : null}

			<LayoutGroup id={`tv-detail-actions-${tvId}`}>
				<motion.div
					layout
					className="flex w-full max-w-md origin-center items-center justify-center gap-3"
				>
					<AnimatePresence mode="popLayout" initial={false}>
						{showWatchlistSlot ? (
							<motion.div
								key="watchlist-slot"
								layout
								initial={motionProps.presenceInitial}
								animate={motionProps.presenceAnimate}
								exit={motionProps.presenceExit}
								transition={motionProps.swapTransition}
							>
								<DetailWatchlistButton
									inWatchlist={inWatchlist}
									hydrated={hydrated}
									busy={logBusy === "watchlist"}
									onToggle={toggleWatchlist}
								/>
							</motion.div>
						) : null}
					</AnimatePresence>

					<motion.button
						type="button"
						className={cn(
							"inline-flex shrink-0 items-center justify-center rounded-full",
							DETAIL_MOTION_PRESSABLE_CLASS,
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							"disabled:pointer-events-none disabled:opacity-45",
							hasLogged && !showMarkNext
								? cn(circle, "disabled:opacity-40")
								: primaryPill,
						)}
						style={motionProps.style}
						layout
						data-primary-action
						data-logged={hasLogged || undefined}
						whileHover={motionProps.hover}
						whileTap={motionProps.tap}
						transition={motionProps.buttonTransition}
						onClick={handlePrimaryClick}
						disabled={
							!hydrated || watchBusy === "start" || watchBusy === "mark"
						}
						aria-label={
							showMarkNext
								? "Mark the next unwatched episode as watched"
								: !hasWatch && !hasLogged
									? "Start watching this show"
									: hasLogged
										? showLogCount > 1
											? `Record another watch (${showLogCount} series logs)`
											: showLogCount === 1
												? "Record another time you watched this series"
												: "Log this show to your diary"
										: "Log this show to your diary"
						}
					>
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.span
								key={primaryKey}
								className={cn(
									"inline-flex items-center justify-center gap-1.5",
									DETAIL_MOTION_SWAP_CLASS,
								)}
								layout="position"
								initial={motionProps.swapInitial}
								animate={motionProps.swapAnimate}
								exit={motionProps.swapExit}
								transition={motionProps.swapTransition}
							>
								{!hydrated || watchBusy === "start" || watchBusy === "mark" ? (
									<Loader2 className="size-5 animate-spin" aria-hidden />
								) : showMarkNext ? (
									primaryLabel
								) : hasLogged && !showMarkNext ? (
									<span className="relative inline-flex">
										<IconPlayRotateAnticlockwise
											size="22px"
											className="shrink-0 opacity-90"
											aria-hidden
										/>
										{showLogCount > 1 ? (
											<span
												className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-foreground font-semibold text-[10px] text-background tabular-nums"
												aria-hidden
											>
												{showLogCount}
											</span>
										) : null}
									</span>
								) : (
									primaryLabel
								)}
							</motion.span>
						</AnimatePresence>
					</motion.button>

					{showDiarySecondary ? (
						<motion.button
							type="button"
							className={cn(
								hasLogged && !showMarkNext ? circle : primaryPill,
								DETAIL_MOTION_PRESSABLE_CLASS,
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								"disabled:pointer-events-none disabled:opacity-45",
							)}
							style={motionProps.style}
							layout
							data-primary-action
							whileHover={motionProps.hover}
							whileTap={motionProps.tap}
							transition={motionProps.buttonTransition}
							onClick={() => {
								if (hasLogged && latestLog && !showMarkNext) {
									handleEditLatestLog();
								} else {
									handleOpenQuickLog();
								}
							}}
							disabled={!hydrated}
							aria-label={
								hasLogged && latestLog && !showMarkNext
									? "Edit your latest diary log"
									: "Log to diary"
							}
						>
							{hasLogged && latestLog && !showMarkNext ? (
								<IconPen2Fill
									size="22px"
									className="shrink-0 opacity-90"
									aria-hidden
								/>
							) : (
								<span className="font-semibold text-sm">Log to diary</span>
							)}
						</motion.button>
					) : null}

					<AddToListControl
						media={{ listingKind: "tv", tmdbId: tvId, title }}
						disabled={!hydrated}
					/>
				</motion.div>
			</LayoutGroup>
		</div>
	);
}
