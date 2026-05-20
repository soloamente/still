"use client";

import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import IconListPlay from "@still/ui/icons/list-play";
import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import IconPlayRotateAnticlockwise from "@still/ui/icons/play-rotate-anticlockwise";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { toast } from "sonner";

import { useTvDetailUserState } from "@/components/tv/use-tv-detail-user-state";
import {
	DETAIL_MOTION_PRESSABLE_CLASS,
	DETAIL_MOTION_SWAP_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";

/**
 * Hero action row for TV — watchlist + diary log + list picker. Matches film detail
 * layout (`MovieDetailPrimaryActions`) without the review composer (reviews are film-only for now).
 */
export function TvDetailPrimaryActions({
	tvId,
	title,
	posterUrl,
	averageRating,
}: {
	tvId: number;
	title: string;
	posterUrl?: string | null;
	averageRating?: number | null;
}) {
	const {
		hydrated,
		myLogs,
		inWatchlist,
		busy,
		latestLog,
		handleOpenQuickLog,
		handleEditLatestLog,
		toggleWatchlist,
	} = useTvDetailUserState(tvId, title, { posterUrl, averageRating });

	const hasLogged = myLogs.length > 0;
	const motionProps = useDetailActionMotion();

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
		: hasLogged
			? `watch-again-${myLogs.length}`
			: "add-watched";

	const watchlistKey =
		!hydrated || busy === "watchlist"
			? "watchlist-busy"
			: inWatchlist
				? "watchlist-on"
				: "watchlist-off";

	function handleAddToList() {
		toast.info(
			"Lists are for films — open the movie page to add this title to a list.",
		);
	}

	return (
		<LayoutGroup id={`tv-detail-actions-${tvId}`}>
			<motion.div
				layout
				className="flex w-full max-w-md origin-center items-center justify-center gap-3"
			>
				<AnimatePresence mode="popLayout" initial={false}>
					{!hasLogged ? (
						<motion.div
							key="watchlist-slot"
							layout
							initial={motionProps.presenceInitial}
							animate={motionProps.presenceAnimate}
							exit={motionProps.presenceExit}
							transition={motionProps.swapTransition}
						>
							<motion.button
								type="button"
								className={cn(circle, DETAIL_MOTION_PRESSABLE_CLASS)}
								style={motionProps.style}
								layout
								data-primary-action
								data-watchlist={inWatchlist || undefined}
								whileHover={motionProps.hover}
								whileTap={motionProps.tap}
								transition={motionProps.buttonTransition}
								onClick={toggleWatchlist}
								disabled={!hydrated || busy === "watchlist"}
								aria-pressed={inWatchlist}
								aria-label={
									inWatchlist ? "Remove from watchlist" : "Add to watchlist"
								}
							>
								<AnimatePresence mode="popLayout" initial={false}>
									<motion.span
										key={watchlistKey}
										className={cn(
											"inline-flex items-center justify-center",
											DETAIL_MOTION_SWAP_CLASS,
										)}
										layout="position"
										initial={motionProps.swapInitial}
										animate={motionProps.swapAnimate}
										exit={motionProps.swapExit}
										transition={motionProps.swapTransition}
									>
										{!hydrated || busy === "watchlist" ? (
											<Loader2
												className="size-5 animate-spin opacity-70"
												aria-hidden
											/>
										) : (
											<IconClockRotateClockwise
												size="22px"
												className={cn(
													"shrink-0",
													inWatchlist ? "opacity-100" : "opacity-80",
												)}
												aria-hidden
											/>
										)}
									</motion.span>
								</AnimatePresence>
							</motion.button>
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
						hasLogged ? cn(circle, "disabled:opacity-40") : primaryPill,
					)}
					style={motionProps.style}
					layout
					data-primary-action
					data-logged={hasLogged || undefined}
					whileHover={motionProps.hover}
					whileTap={motionProps.tap}
					transition={motionProps.buttonTransition}
					onClick={handleOpenQuickLog}
					disabled={!hydrated}
					aria-label={
						hasLogged
							? myLogs.length > 1
								? `Record another watch (${myLogs.length} logs)`
								: "Record another time you watched this show"
							: "Record that you watched this show"
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
							{!hydrated ? (
								<Loader2 className="size-5 animate-spin" aria-hidden />
							) : hasLogged ? (
								<span className="relative inline-flex">
									<IconPlayRotateAnticlockwise
										size="22px"
										className="shrink-0 opacity-90"
										aria-hidden
									/>
									{myLogs.length > 1 ? (
										<span
											className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-foreground font-semibold text-[10px] text-background tabular-nums"
											aria-hidden
										>
											{myLogs.length}
										</span>
									) : null}
								</span>
							) : (
								"Add to Watched"
							)}
						</motion.span>
					</AnimatePresence>
				</motion.button>

				<AnimatePresence mode="popLayout" initial={false}>
					{hasLogged && latestLog ? (
						<motion.div
							key="edit-action"
							layout
							initial={motionProps.presenceInitial}
							animate={motionProps.presenceAnimate}
							exit={motionProps.presenceExit}
							transition={motionProps.swapTransition}
						>
							<motion.button
								type="button"
								className={cn(circle, DETAIL_MOTION_PRESSABLE_CLASS)}
								style={motionProps.style}
								layout
								data-primary-action
								whileHover={motionProps.hover}
								whileTap={motionProps.tap}
								transition={motionProps.buttonTransition}
								onClick={handleEditLatestLog}
								disabled={!hydrated}
								aria-label="Edit your latest diary log"
							>
								<IconPen2Fill
									size="22px"
									className="shrink-0 opacity-90"
									aria-hidden
								/>
							</motion.button>
						</motion.div>
					) : null}
				</AnimatePresence>

				<motion.button
					type="button"
					className={cn(circle, DETAIL_MOTION_PRESSABLE_CLASS)}
					style={motionProps.style}
					layout
					data-primary-action
					whileHover={motionProps.hover}
					whileTap={motionProps.tap}
					transition={motionProps.buttonTransition}
					onClick={handleAddToList}
					disabled={!hydrated}
					aria-label="Add to list"
				>
					<IconListPlay size="22px" className="shrink-0 opacity-90" />
				</motion.button>
			</motion.div>
		</LayoutGroup>
	);
}
