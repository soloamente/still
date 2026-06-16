"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export type PatronOnlineDotSize = "sm" | "md" | "lg";

export type PatronPresenceDotState = "active" | "away";

/** Scale the badge to the portrait — podium tiles use `lg`, feed rows `sm`. */
export function resolvePatronOnlineDotSize(width: number): PatronOnlineDotSize {
	if (width >= 56) return "lg";
	if (width >= 40) return "md";
	return "sm";
}

const DOT_SIZE_CLASS: Record<PatronOnlineDotSize, string> = {
	sm: "size-2.5",
	md: "size-3",
	lg: "size-3.5",
};

/** Sit on the rim of the circle — geometric center reads too high/inward. */
const DOT_POSITION_CLASS: Record<PatronOnlineDotSize, string> = {
	sm: "right-0 bottom-0 translate-x-[18%] translate-y-[18%]",
	md: "right-0 bottom-0 translate-x-[14%] translate-y-[14%]",
	lg: "right-0.5 bottom-0.5 translate-x-[8%] translate-y-[8%]",
};

const DOT_SCRIM_SHADOW =
	"shadow-[0_0_0_2px_var(--background),0_1px_4px_color-mix(in_oklab,black_32%,transparent)] dark:shadow-[0_0_0_2px_var(--background),0_1px_5px_color-mix(in_oklab,black_55%,transparent)]";

/** Background color for active (green) vs away (orange) presence badges. */
export function presenceDotSurfaceClass(state: PatronPresenceDotState): string {
	return cn(
		"rounded-full",
		DOT_SCRIM_SHADOW,
		state === "active" ? "bg-emerald-400" : "bg-desert-orange",
	);
}

const DOT_MOTION_TRANSITION = {
	type: "spring" as const,
	duration: 0.3,
	bounce: 0,
};

const DOT_STATE_FLIP_TRANSITION = {
	scale: { duration: 0.18, bounce: 0 },
	opacity: DOT_MOTION_TRANSITION,
	filter: DOT_MOTION_TRANSITION,
};

/**
 * Online-now badge for patron portraits — green when active, orange when away,
 * with mount pop and a micro-pop on active ↔ away color changes.
 */
export function PatronOnlineDot({
	presenceState,
	label,
	size = "md",
	className,
}: {
	presenceState: PatronPresenceDotState | null;
	label: string;
	size?: PatronOnlineDotSize;
	className?: string;
}) {
	const reducedMotion = usePrefersReducedMotion();
	const prevStateRef = useRef<PatronPresenceDotState | null>(null);
	const [stateFlipTick, setStateFlipTick] = useState(0);
	const [isStateFlipAnimating, setIsStateFlipAnimating] = useState(false);

	// Bump flip tick when color state changes while the dot stays mounted.
	useEffect(() => {
		if (!presenceState) {
			prevStateRef.current = null;
			setIsStateFlipAnimating(false);
			return;
		}

		const prev = prevStateRef.current;
		prevStateRef.current = presenceState;

		if (prev && prev !== presenceState && !reducedMotion) {
			setStateFlipTick((tick) => tick + 1);
			setIsStateFlipAnimating(true);
		}
	}, [presenceState, reducedMotion]);

	const shouldMicroPop =
		!reducedMotion && isStateFlipAnimating && stateFlipTick > 0;

	return (
		<AnimatePresence initial={false}>
			{presenceState ? (
				<motion.span
					key="patron-online-dot"
					role="img"
					aria-label={label}
					initial={
						reducedMotion
							? false
							: { opacity: 0, scale: 0.25, filter: "blur(4px)" }
					}
					animate={{
						opacity: 1,
						scale: shouldMicroPop ? [1, 1.12, 1] : 1,
						filter: "blur(0px)",
					}}
					exit={
						reducedMotion
							? undefined
							: { opacity: 0, scale: 0.25, filter: "blur(4px)" }
					}
					transition={
						shouldMicroPop ? DOT_STATE_FLIP_TRANSITION : DOT_MOTION_TRANSITION
					}
					onAnimationComplete={() => {
						if (isStateFlipAnimating) {
							setIsStateFlipAnimating(false);
						}
					}}
					className={cn(
						"pointer-events-none absolute z-30",
						presenceDotSurfaceClass(presenceState),
						!reducedMotion && "transition-colors duration-150",
						DOT_SIZE_CLASS[size],
						DOT_POSITION_CLASS[size],
						className,
					)}
				/>
			) : null}
		</AnimatePresence>
	);
}
