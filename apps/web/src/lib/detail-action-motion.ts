"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

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
	// Motion reads reduced-motion + applies inline styles only after mount — keep SSR and
	// the first client paint identical so detail chrome (list/movie top bars, section nav) hydrates cleanly.
	const [motionReady, setMotionReady] = useState(false);

	useEffect(() => {
		setMotionReady(true);
	}, []);

	const motionEnabled = motionReady && !reduceMotion;

	return {
		hover: motionEnabled ? { scale: 1.05 } : undefined,
		tap: motionEnabled ? { scale: 0.95 } : undefined,
		style: motionEnabled
			? {
					transformOrigin: "center center",
					originX: 0.5 as const,
					originY: 0.5 as const,
				}
			: undefined,
		buttonTransition: motionEnabled
			? { type: "spring" as const, ...DETAIL_BUTTON_SPRING }
			: { duration: 0 },
		swapTransition: motionEnabled
			? { type: "spring" as const, ...DETAIL_SWAP_SPRING }
			: { duration: 0 },
		swapInitial: motionEnabled ? detailSwapChildVariants.initial : false,
		swapAnimate: motionEnabled ? detailSwapChildVariants.animate : undefined,
		swapExit: motionEnabled ? detailSwapChildVariants.exit : undefined,
		presenceInitial: motionEnabled ? { opacity: 0, scale: 0.88 } : false,
		presenceAnimate: motionEnabled ? { opacity: 1, scale: 1 } : undefined,
		presenceExit: motionEnabled ? { opacity: 0, scale: 0.88 } : undefined,
	};
}
