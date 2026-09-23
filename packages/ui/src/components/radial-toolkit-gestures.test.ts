import { describe, expect, test } from "bun:test";
import {
	exceedsLongPressSlop,
	isRadialToolkitKeyboardTrigger,
	radialShortcutIndex,
	radialTapTarget,
	stepRadialIndex,
} from "./radial-toolkit-gestures";

describe("exceedsLongPressSlop", () => {
	test("stays within 10px → still a long-press", () => {
		expect(exceedsLongPressSlop({ x: 0, y: 0 }, { x: 6, y: 8 })).toBe(false);
	});
	test("exactly 10px is still within slop", () => {
		expect(exceedsLongPressSlop({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
	});
	test("beyond 10px cancels (scroll wins)", () => {
		expect(exceedsLongPressSlop({ x: 0, y: 0 }, { x: 0, y: 11 })).toBe(true);
	});
	test("custom slop", () => {
		expect(exceedsLongPressSlop({ x: 0, y: 0 }, { x: 4, y: 0 }, 3)).toBe(true);
	});
});

describe("isRadialToolkitKeyboardTrigger", () => {
	test("ContextMenu key", () => {
		expect(
			isRadialToolkitKeyboardTrigger({ key: "ContextMenu", shiftKey: false }),
		).toBe(true);
	});
	test("Shift+F10 only with shift", () => {
		expect(isRadialToolkitKeyboardTrigger({ key: "F10", shiftKey: true })).toBe(
			true,
		);
		expect(
			isRadialToolkitKeyboardTrigger({ key: "F10", shiftKey: false }),
		).toBe(false);
	});
	test("other keys ignored", () => {
		expect(
			isRadialToolkitKeyboardTrigger({ key: "Enter", shiftKey: true }),
		).toBe(false);
	});
});

describe("stepRadialIndex", () => {
	const none = [false, false, false];
	test("from no selection", () => {
		expect(stepRadialIndex(-1, 1, none)).toBe(0);
		expect(stepRadialIndex(-1, -1, none)).toBe(2);
	});
	test("wraps both ways", () => {
		expect(stepRadialIndex(2, 1, none)).toBe(0);
		expect(stepRadialIndex(0, -1, none)).toBe(2);
	});
	test("skips disabled", () => {
		expect(stepRadialIndex(0, 1, [false, true, false])).toBe(2);
		expect(stepRadialIndex(-1, 1, [true, false])).toBe(1);
	});
	test("all disabled or empty → -1", () => {
		expect(stepRadialIndex(0, 1, [true, true])).toBe(-1);
		expect(stepRadialIndex(-1, 1, [])).toBe(-1);
	});
});

describe("radialShortcutIndex", () => {
	const items = [
		{ shortcut: "L" },
		{ shortcut: "R", disabled: true },
		{ shortcut: "a" },
	];
	test("case-insensitive match", () => {
		expect(radialShortcutIndex("l", items)).toBe(0);
		expect(radialShortcutIndex("A", items)).toBe(2);
	});
	test("disabled or unknown → -1", () => {
		expect(radialShortcutIndex("r", items)).toBe(-1);
		expect(radialShortcutIndex("z", items)).toBe(-1);
		expect(radialShortcutIndex("Enter", items)).toBe(-1);
	});
});

describe("radialTapTarget", () => {
	const base = { hubDeadZonePx: 30, reachPx: 120 };
	test("hub", () => {
		expect(
			radialTapTarget({ ...base, dx: 5, dy: 5, disabled: [false, false] }),
		).toEqual({ kind: "hub" });
	});
	test("outside reach dismisses", () => {
		expect(
			radialTapTarget({ ...base, dx: 0, dy: -200, disabled: [false] }),
		).toEqual({ kind: "outside" });
	});
	test("top = item 0, right = item 1 of 4", () => {
		const disabled = [false, false, false, false];
		expect(radialTapTarget({ ...base, dx: 0, dy: -64, disabled })).toEqual({
			kind: "item",
			index: 0,
		});
		expect(radialTapTarget({ ...base, dx: 64, dy: 0, disabled })).toEqual({
			kind: "item",
			index: 1,
		});
	});
	test("disabled segment", () => {
		expect(
			radialTapTarget({ ...base, dx: 0, dy: 64, disabled: [false, true] }),
		).toEqual({ kind: "disabled" });
	});
});
