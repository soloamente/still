/** Top edge of the first notice in the stack. */
export const TOAST_EDGE_TOP_PX = 20;
/** Space between stacked notices. */
export const TOAST_STACK_GAP_PX = 8;

export type ToastStackSlot = "playback" | "countdown";

export const TOAST_SLOT_ORDER: ToastStackSlot[] = ["playback", "countdown"];

export const TOAST_SLOT_HOST_ID: Record<ToastStackSlot, string> = {
	playback: "sense-companion-toast",
	countdown: "sense-companion-autolog-toast",
};

/**
 * Each visible slot gets a top offset. When a row above disappears, the rows
 * below move up to the next free slot (caller animates `top`).
 */
export function computeToastStackTops(input: {
	visible: Record<ToastStackSlot, boolean>;
	heights: Record<ToastStackSlot, number>;
}): Partial<Record<ToastStackSlot, number>> {
	let y = TOAST_EDGE_TOP_PX;
	const tops: Partial<Record<ToastStackSlot, number>> = {};
	for (const slot of TOAST_SLOT_ORDER) {
		if (!input.visible[slot]) continue;
		const height = input.heights[slot];
		if (!Number.isFinite(height) || height <= 0) continue;
		tops[slot] = y;
		y += height + TOAST_STACK_GAP_PX;
	}
	return tops;
}
