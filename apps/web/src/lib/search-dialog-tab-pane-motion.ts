import type { Transition, Variant } from "motion/react";

/** Snappy enter when Movies / Shows / People tab changes in ⌘K. */
export const SEARCH_DIALOG_TAB_PANE_TRANSITION = {
	duration: 0.14,
	ease: [0.25, 0.1, 0.25, 1],
} as const satisfies Transition;

export function searchDialogTabPaneInitial(
	reduceMotion: boolean | null,
): Variant | false {
	if (reduceMotion) return false;
	return { opacity: 0, y: 3 };
}

export const SEARCH_DIALOG_TAB_PANE_ANIMATE: Variant = {
	opacity: 1,
	y: 0,
};

export const SEARCH_DIALOG_RAIL_ENTER_TRANSITION = {
	duration: 0.12,
	ease: [0.25, 0.1, 0.25, 1],
} as const satisfies Transition;

export function searchDialogRailEnterInitial(
	reduceMotion: boolean | null,
): Variant | false {
	if (reduceMotion) return false;
	return { opacity: 0 };
}

export const SEARCH_DIALOG_RAIL_ENTER_ANIMATE: Variant = { opacity: 1 };

/** Recent-search pill dismiss — quick scale fade so the rail reflows smoothly. */
export const SEARCH_DIALOG_RECENT_CHIP_EXIT_TRANSITION = {
	duration: 0.16,
	ease: [0.25, 0.1, 0.25, 1],
} as const satisfies Transition;

export function searchDialogRecentChipExit(
	reduceMotion: boolean | null,
): Variant {
	if (reduceMotion) return { opacity: 0 };
	return { opacity: 0, scale: 0.94 };
}
