"use client";

import { useReducedMotion } from "motion/react";

/** Spring for hero + chrome pressables — matches `MovieDetailPrimaryActions`. */
export const DETAIL_BUTTON_SPRING = { stiffness: 400, damping: 20 } as const;

export const DETAIL_SWAP_SPRING = { stiffness: 260, damping: 18 } as const;

export const detailSwapChildVariants = {
	initial: { opacity: 0, filter: "blur(4px)" },
	animate: { opacity: 1, filter: "blur(0px)" },
	exit: { opacity: 0, filter: "blur(4px)" },
} as const;

/** GPU layer for spring scale; origin-center keeps hover/tap centered on the control. */
export const DETAIL_MOTION_PRESSABLE_CLASS =
	"origin-center will-change-transform";

export const DETAIL_MOTION_SWAP_CLASS =
	"will-change-[transform,opacity,filter]";

/**
 * Hover wash for `bg-background` (canvas) controls sitting on `bg-card` (raised).
 * Avoid `hover:bg-muted/*` — `--muted` aliases the same ink as `--card` and the control
 * disappears against the section surface.
 */
export const DETAIL_CANVAS_ON_CARD_HOVER_CLASS =
	"hover:bg-background [@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground";

/**
 * Shared hover/tap scale for film + TV detail pressables (hero row, sticky top bar,
 * section rail, credits link). **Not** for segmented tabs (About / Streaming, explore tabs).
 */
export function useDetailActionMotion() {
	const reduceMotion = useReducedMotion();

	return {
		hover: reduceMotion ? undefined : { scale: 1.05 },
		tap: reduceMotion ? undefined : { scale: 0.95 },
		style: reduceMotion
			? undefined
			: {
					transformOrigin: "center center",
					originX: 0.5 as const,
					originY: 0.5 as const,
				},
		buttonTransition: reduceMotion
			? { duration: 0 }
			: { type: "spring" as const, ...DETAIL_BUTTON_SPRING },
		swapTransition: reduceMotion
			? { duration: 0 }
			: { type: "spring" as const, ...DETAIL_SWAP_SPRING },
		swapInitial: reduceMotion ? false : detailSwapChildVariants.initial,
		swapAnimate: reduceMotion ? undefined : detailSwapChildVariants.animate,
		swapExit: reduceMotion ? undefined : detailSwapChildVariants.exit,
		presenceInitial: reduceMotion ? false : { opacity: 0, scale: 0.88 },
		presenceAnimate: reduceMotion ? undefined : { opacity: 1, scale: 1 },
		presenceExit: reduceMotion ? undefined : { opacity: 0, scale: 0.88 },
	};
}
