"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** Spring for hero + chrome pressables — matches `MovieDetailPrimaryActions`. */
export const DETAIL_BUTTON_SPRING = { stiffness: 400, damping: 20 } as const;

export const DETAIL_SWAP_SPRING = { stiffness: 260, damping: 18 } as const;

/** Tap scale for sticky detail chrome (top bar, section rail) — no hover lift. */
export const DETAIL_CHROME_TAP_SCALE = 0.97;

/** Tap scale for hero CTAs (watchlist, log, morph row). */
export const DETAIL_HERO_TAP_SCALE = 0.95;

export const DETAIL_HERO_HOVER_SCALE = 1.05;

export type DetailActionMotionVariant = "hero" | "chrome";

export const detailSwapChildVariants = {
	initial: { opacity: 0, filter: "blur(4px)" },
	animate: { opacity: 1, filter: "blur(0px)" },
	exit: { opacity: 0, filter: "blur(4px)" },
} as const;

/** GPU-friendly press layer — avoid static `will-change` (promote only while interacting). */
export const DETAIL_MOTION_PRESSABLE_CLASS = "origin-center";

export const DETAIL_MOTION_SWAP_CLASS = "";

/**
 * Hover wash for `bg-background` (canvas) controls sitting on `bg-card` (raised).
 * Avoid `hover:bg-muted/*` — `--muted` aliases the same ink as `--card` and the control
 * disappears against the section surface.
 */
export const DETAIL_CANVAS_ON_CARD_HOVER_CLASS =
	"hover:bg-background [@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground";

/**
 * Shared hover/tap scale for film + TV detail pressables.
 * **`chrome`** — sticky top bar + section rail: tap-only, subtler scale (high frequency).
 * **`hero`** — hero row morph CTAs: hover + tap (occasional per title).
 */
export function useDetailActionMotion(
	variant: DetailActionMotionVariant = "hero",
) {
	const reduceMotion = useReducedMotion();
	// Motion reads reduced-motion + applies inline styles only after mount — keep SSR and
	// the first client paint identical so detail chrome (list/movie top bars, section nav) hydrates cleanly.
	const [motionReady, setMotionReady] = useState(false);

	useEffect(() => {
		setMotionReady(true);
	}, []);

	const motionEnabled = motionReady && !reduceMotion;
	const isChrome = variant === "chrome";

	return {
		hover:
			motionEnabled && !isChrome
				? { scale: DETAIL_HERO_HOVER_SCALE }
				: undefined,
		tap: motionEnabled
			? {
					scale: isChrome ? DETAIL_CHROME_TAP_SCALE : DETAIL_HERO_TAP_SCALE,
				}
			: undefined,
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
