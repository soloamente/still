"use client";

import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import IconPlayRotateAnticlockwise from "@still/ui/icons/play-rotate-anticlockwise";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

import { AddToListControl } from "@/components/list/add-to-list-control";
import { DetailWatchlistButton } from "@/components/movie/detail-watchlist-button";
import { useMovieDetailUserState } from "@/components/movie/use-movie-detail-user-state";
import { useReviewComposer } from "@/components/review/review-composer";
import {
	DETAIL_MOTION_PRESSABLE_CLASS,
	DETAIL_MOTION_SWAP_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";

/**
 * Hero action row — watchlist (left), diary log (primary pill), add to list (right).
 * After the first log, watchlist exits, the primary pill morphs into a circle control,
 * and review + edit circles appear so we never need a separate “More actions” menu.
 */
export function MovieDetailPrimaryActions({
	movieId,
	title,
	posterUrl,
	averageRating,
}: {
	movieId: number;
	title: string;
	posterUrl?: string | null;
	/** TMDb or Sense community average on 0–10 for the log sheet slider. */
	averageRating?: number | null;
}) {
	const openReviewComposer = useReviewComposer((s) => s.open);
	const {
		hydrated,
		myLogs,
		inWatchlist,
		busy,
		latestLog,
		handleOpenQuickLog,
		handleEditLatestLog,
		toggleWatchlist,
	} = useMovieDetailUserState(movieId, title, { posterUrl, averageRating });

	const hasLogged = myLogs.length > 0;
	const motionProps = useDetailActionMotion();

	/**
	 * `bg-background` (canvas) on `bg-card` (raised) — avoid `hover:bg-muted/*` because
	 * `--muted` aliases the same raised ink as `--card` and the control disappears on hover.
	 */
	const circle = cn(
		"inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-background text-foreground",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
		"disabled:pointer-events-none disabled:opacity-40",
	);

	/** Inverted pill — same treatment as pre-log “Add to Watched” (hero primary CTA). */
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

	function handleOpenReview() {
		openReviewComposer({
			movieId,
			movieTitle: title,
			posterUrl: posterUrl ?? null,
			averageRating: averageRating ?? null,
			diaryLogId: latestLog?.id,
			diaryRatingStored: latestLog?.rating ?? null,
		});
	}

	return (
		<LayoutGroup id={`movie-detail-actions-${movieId}`}>
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
							<DetailWatchlistButton
								inWatchlist={inWatchlist}
								hydrated={hydrated}
								busy={busy === "watchlist"}
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
						hasLogged ? cn(circle, "disabled:opacity-40") : primaryPill,
					)}
					style={motionProps.style}
					layout
					data-primary-action
					data-logged={hasLogged || undefined}
					whileHover={motionProps.hover}
					whileTap={motionProps.tap}
					transition={motionProps.buttonTransition}
					onClick={() => handleOpenQuickLog()}
					disabled={!hydrated}
					aria-label={
						hasLogged
							? myLogs.length > 1
								? `Record another watch (${myLogs.length} logs)`
								: "Record another time you watched this film"
							: "Record that you watched this film"
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
					{hasLogged ? (
						<>
							<motion.div
								key="review-action"
								layout
								initial={motionProps.presenceInitial}
								animate={motionProps.presenceAnimate}
								exit={motionProps.presenceExit}
								transition={motionProps.swapTransition}
							>
								<motion.button
									type="button"
									className={cn(primaryPill, DETAIL_MOTION_PRESSABLE_CLASS)}
									style={motionProps.style}
									layout
									data-primary-action
									whileHover={motionProps.hover}
									whileTap={motionProps.tap}
									transition={motionProps.buttonTransition}
									onClick={handleOpenReview}
									disabled={!hydrated}
								>
									Add review
								</motion.button>
							</motion.div>
							{latestLog ? (
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
						</>
					) : null}
				</AnimatePresence>

				<AddToListControl
					media={{ listingKind: "movie", tmdbId: movieId, title }}
					disabled={!hydrated}
				/>
			</motion.div>
		</LayoutGroup>
	);
}
