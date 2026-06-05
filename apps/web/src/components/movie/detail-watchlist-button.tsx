"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import {
	DETAIL_MOTION_PRESSABLE_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";

/** Contextual icon swap — matches `make-interfaces-feel-better` (opacity + scale + blur, bounce 0). */
const ICON_VISIBLE = { opacity: 1, scale: 1, filter: "blur(0px)" };
const ICON_HIDDEN = { opacity: 0, scale: 0.25, filter: "blur(4px)" };

const ICON_SPRING = {
	type: "spring" as const,
	duration: 0.3,
	bounce: 0,
};

/** Compact label — matches sticky header shortcut tooltips. */
const DETAIL_ICON_TOOLTIP_CLASS = "px-2 py-2 text-xs leading-none";

/**
 * Hero watchlist control — inverted fill when saved; clock/check stay mounted and
 * crossfade with contextual blur (no AnimatePresence — avoids mount/unmount flicker).
 */
export function DetailWatchlistButton({
	inWatchlist,
	hydrated,
	busy,
	onToggle,
}: {
	inWatchlist: boolean;
	hydrated: boolean;
	busy: boolean;
	onToggle: () => void;
}) {
	const motionProps = useDetailActionMotion();
	const reduceMotion = useReducedMotion();
	const isBusy = !hydrated || busy;

	const iconTransition = reduceMotion ? { duration: 0 } : ICON_SPRING;

	return (
		<TooltipProvider delay={0} closeDelay={80}>
			<Tooltip>
				<TooltipTrigger
					delay={0}
					render={
						<motion.button
							type="button"
							className={cn(
								"inline-flex size-12 shrink-0 items-center justify-center rounded-full",
								"transition-[background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								"disabled:pointer-events-none disabled:opacity-40",
								inWatchlist
									? "bg-foreground text-background shadow-[0_6px_28px_-10px_rgba(0,0,0,0.55)]"
									: "bg-background text-foreground",
								DETAIL_MOTION_PRESSABLE_CLASS,
							)}
							style={motionProps.style}
							data-primary-action
							data-watchlist={inWatchlist || undefined}
							whileHover={motionProps.hover}
							whileTap={motionProps.tap}
							transition={motionProps.buttonTransition}
							onClick={onToggle}
							disabled={isBusy}
							aria-pressed={inWatchlist}
							aria-busy={isBusy || undefined}
							aria-label={
								inWatchlist ? "On your watchlist — remove" : "Add to watchlist"
							}
						>
							<span className="relative flex size-[22px] items-center justify-center">
								<motion.span
									className="pointer-events-none absolute inset-0 flex items-center justify-center"
									initial={false}
									animate={inWatchlist ? ICON_VISIBLE : ICON_HIDDEN}
									transition={iconTransition}
									aria-hidden={!inWatchlist}
								>
									<Check className="size-5 stroke-[2.5]" />
								</motion.span>
								<motion.span
									className="pointer-events-none absolute inset-0 flex items-center justify-center"
									initial={false}
									animate={inWatchlist ? ICON_HIDDEN : ICON_VISIBLE}
									transition={iconTransition}
									aria-hidden={inWatchlist}
								>
									<IconClockRotateClockwise
										size="22px"
										className="shrink-0 opacity-90"
									/>
								</motion.span>
							</span>
						</motion.button>
					}
				/>
				<TooltipContent sideOffset={8} className={DETAIL_ICON_TOOLTIP_CLASS}>
					Watchlist
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
