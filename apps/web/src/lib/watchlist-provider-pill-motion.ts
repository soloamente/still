import type { WatchlistFlyPathEasing } from "@/lib/watchlist-provider-fly-path";

/** Provider filter pill shell reveal — spring visual duration (seconds). */
export const WATCHLIST_PILL_SHELL_VISUAL_DURATION_S = 0.45;

export const WATCHLIST_PILL_FLY_DURATION_S = 0.5;

/** Defer router updates until fly + shell motion finish. */
export const WATCHLIST_PILL_NAVIGATE_DEFER_MS =
	Math.round(WATCHLIST_PILL_FLY_DURATION_S * 1000) +
	Math.round(WATCHLIST_PILL_SHELL_VISUAL_DURATION_S * 1000) +
	80;

/** Locked motion tokens for the watchlist streaming provider pill + logo fly. */
export const WATCHLIST_PROVIDER_PILL_MOTION = {
	shell: {
		closedScale: 0.8,
		closedOpacity: 0,
		closedBlur: 12,
	},
	stackBlurPx: 0,
	landBounceScale: 0.95,
	spring: {
		type: "spring" as const,
		visualDuration: WATCHLIST_PILL_SHELL_VISUAL_DURATION_S,
		bounce: 0.65,
	},
	fly: {
		path: {
			type: "easing",
			duration: WATCHLIST_PILL_FLY_DURATION_S,
			ease: [0.22, 1, 0.36, 1],
		} satisfies WatchlistFlyPathEasing,
		arcLiftScale: 2.7,
	},
} as const;
