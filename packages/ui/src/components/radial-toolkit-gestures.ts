/**
 * Pure geometry + input helpers for `RadialToolkit` / `useRadialToolkitAnchor`.
 * No DOM access so they stay unit-testable under `bun test`.
 */

/** Touch hold before the toolkit opens (shorter than iOS's ~500ms link callout). */
export const LONG_PRESS_DELAY_MS = 450;
/** Finger travel that turns a hold into a scroll and cancels the long-press. */
export const LONG_PRESS_SLOP_PX = 10;
/** Window after a fired long-press in which the synthesized click is swallowed. */
export const LONG_PRESS_CLICK_SUPPRESS_MS = 700;

type Point = { x: number; y: number };

/** True once the pointer drifted strictly further than `slopPx` from `start`. */
export function exceedsLongPressSlop(
	start: Point,
	current: Point,
	slopPx: number = LONG_PRESS_SLOP_PX,
): boolean {
	return Math.hypot(current.x - start.x, current.y - start.y) > slopPx;
}

/** `ContextMenu` key or `Shift+F10` — the platform "open context menu" keys. */
export function isRadialToolkitKeyboardTrigger(event: {
	key: string;
	shiftKey: boolean;
}): boolean {
	return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

/** Pointer angle from hub: 0° = top, clockwise. */
export function pointerAngleDeg(
	centerX: number,
	centerY: number,
	clientX: number,
	clientY: number,
): number {
	const rad = Math.atan2(clientX - centerX, -(clientY - centerY));
	let deg = (rad * 180) / Math.PI;
	if (deg < 0) deg += 360;
	return deg;
}

export function segmentIndex(
	deg: number,
	count: number,
	stepDeg: number,
): number {
	return Math.floor((deg + stepDeg / 2) / stepDeg) % count;
}

/**
 * Next enabled index moving `delta` around the ring (wraps). From `-1`,
 * `+1` lands on the first enabled item and `-1` on the last. Returns `-1`
 * when every item is disabled.
 */
export function stepRadialIndex(
	current: number,
	delta: 1 | -1,
	disabled: readonly boolean[],
): number {
	const count = disabled.length;
	if (count === 0) return -1;
	let index = current < 0 ? (delta === 1 ? -1 : 0) : current;
	for (let i = 0; i < count; i += 1) {
		index = (index + delta + count) % count;
		if (!disabled[index]) return index;
	}
	return -1;
}

/** Index of the enabled item whose `shortcut` matches `key` (case-insensitive), else `-1`. */
export function radialShortcutIndex(
	key: string,
	items: readonly { shortcut?: string; disabled?: boolean }[],
): number {
	if (key.length !== 1) return -1;
	const wanted = key.toLowerCase();
	return items.findIndex(
		(item) => !item.disabled && item.shortcut?.toLowerCase() === wanted,
	);
}

export type RadialTapTarget =
	| { kind: "hub" }
	| { kind: "outside" }
	| { kind: "disabled" }
	| { kind: "item"; index: number };

/** Resolves a tap relative to the hub center into hub / ring item / outside. */
export function radialTapTarget({
	dx,
	dy,
	hubDeadZonePx,
	reachPx,
	disabled,
}: {
	dx: number;
	dy: number;
	hubDeadZonePx: number;
	/** Taps further than this from the hub dismiss the toolkit. */
	reachPx: number;
	disabled: readonly boolean[];
}): RadialTapTarget {
	const distance = Math.hypot(dx, dy);
	if (distance < hubDeadZonePx) return { kind: "hub" };
	if (distance > reachPx || disabled.length === 0) return { kind: "outside" };
	const stepDeg = 360 / disabled.length;
	const index = segmentIndex(
		pointerAngleDeg(0, 0, dx, dy),
		disabled.length,
		stepDeg,
	);
	if (disabled[index]) return { kind: "disabled" };
	return { kind: "item", index };
}
