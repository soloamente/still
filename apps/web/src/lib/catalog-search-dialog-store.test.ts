import { beforeAll, describe, expect, test } from "bun:test";

import {
	CATALOG_SEARCH_PANEL_MAX_WIDTH_PX,
	CATALOG_SEARCH_PANEL_MIN_WIDTH_PX,
	CATALOG_SEARCH_VIEWPORT_GUTTER_PX,
	clampCatalogSearchPanelLeftFromCenter,
	computeCatalogSearchAnchoredPanelStyle,
	defaultCatalogSearchShortcutAnchorRect,
	isCatalogSearchAnchorVisibleInViewport,
	normalizeCatalogSearchAnchorRect,
} from "./catalog-search-dialog-store";

/** Bun tests run without a browser `window`; stub dimensions for layout helpers. */
function stubViewport(width: number, height: number): void {
	Object.defineProperty(globalThis, "innerWidth", {
		value: width,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(globalThis, "innerHeight", {
		value: height,
		configurable: true,
		writable: true,
	});
	if (typeof globalThis.window === "undefined") {
		// @ts-expect-error — minimal DOM stub for `window.innerWidth` reads in store helpers
		globalThis.window = globalThis;
	}
}

/** Minimal `DOMRect` stand-in — layout helpers only read `left` / `top` / `width` / `height`. */
function anchorRect(
	left: number,
	top: number,
	width: number,
	height: number,
): DOMRect {
	return { left, top, width, height } as DOMRect;
}

beforeAll(() => {
	stubViewport(1280, 800);
	if (typeof globalThis.DOMRect === "undefined") {
		// Bun tests have no browser DOMRect — layout helpers still construct rects at runtime.
		globalThis.DOMRect = class DOMRectPolyfill {
			readonly x: number;
			readonly y: number;
			readonly width: number;
			readonly height: number;
			readonly top: number;
			readonly left: number;
			constructor(x = 0, y = 0, width = 0, height = 0) {
				this.x = x;
				this.y = y;
				this.width = width;
				this.height = height;
				this.top = y;
				this.left = x;
			}
			get right() {
				return this.left + this.width;
			}
			get bottom() {
				return this.top + this.height;
			}
		} as unknown as typeof DOMRect;
	}
});

describe("clampCatalogSearchPanelLeftFromCenter", () => {
	test("centers panel when viewport is wide enough", () => {
		stubViewport(1200, 800);
		const width = 640;
		const centerX = 600;
		expect(clampCatalogSearchPanelLeftFromCenter(centerX, width)).toBe(
			centerX - width / 2,
		);
	});

	test("clamps to left gutter when center is too far left", () => {
		stubViewport(400, 800);
		const width = 360;
		expect(clampCatalogSearchPanelLeftFromCenter(40, width)).toBe(
			CATALOG_SEARCH_VIEWPORT_GUTTER_PX,
		);
	});

	test("clamps to right gutter when center is too far right", () => {
		stubViewport(500, 800);
		const width = 400;
		const left = clampCatalogSearchPanelLeftFromCenter(480, width);
		expect(left).toBe(500 - width - CATALOG_SEARCH_VIEWPORT_GUTTER_PX);
	});
});

describe("computeCatalogSearchAnchoredPanelStyle", () => {
	test("uses panel min width when trigger is narrow", () => {
		stubViewport(1280, 900);
		const trigger = anchorRect(400, 88, 280, 48);
		const layout = computeCatalogSearchAnchoredPanelStyle(trigger);
		expect(layout.width).toBe(CATALOG_SEARCH_PANEL_MIN_WIDTH_PX);
		expect(layout.left).toBe(
			clampCatalogSearchPanelLeftFromCenter(
				trigger.left + trigger.width / 2,
				layout.width,
			),
		);
	});

	test("caps width at panel max on large viewports", () => {
		stubViewport(2000, 1000);
		const trigger = anchorRect(800, 80, 576, 48);
		const layout = computeCatalogSearchAnchoredPanelStyle(trigger);
		expect(layout.width).toBe(CATALOG_SEARCH_PANEL_MAX_WIDTH_PX);
	});

	test("never exceeds viewport minus gutters", () => {
		stubViewport(620, 800);
		const trigger = anchorRect(12, 72, 596, 48);
		const layout = computeCatalogSearchAnchoredPanelStyle(trigger);
		expect(layout.width).toBeLessThanOrEqual(
			620 - CATALOG_SEARCH_VIEWPORT_GUTTER_PX * 2,
		);
	});
});

describe("isCatalogSearchAnchorVisibleInViewport", () => {
	test("returns false when trigger is above the viewport", () => {
		stubViewport(1280, 900);
		expect(
			isCatalogSearchAnchorVisibleInViewport(anchorRect(400, -120, 280, 48)),
		).toBe(false);
	});

	test("returns true for the sticky header lane", () => {
		stubViewport(1280, 900);
		expect(
			isCatalogSearchAnchorVisibleInViewport(anchorRect(400, 88, 280, 48)),
		).toBe(true);
	});
});

describe("normalizeCatalogSearchAnchorRect", () => {
	test("falls back to the shortcut lane when the trigger scrolled off-screen", () => {
		stubViewport(1280, 900);
		const offScreen = anchorRect(400, -200, 280, 48);
		const normalized = normalizeCatalogSearchAnchorRect(offScreen);
		const fallback = defaultCatalogSearchShortcutAnchorRect();
		expect(normalized.top).toBe(fallback.top);
		expect(normalized.left).toBe(fallback.left);
		expect(normalized.width).toBe(fallback.width);
	});

	test("keeps on-screen trigger geometry", () => {
		stubViewport(1280, 900);
		const onScreen = anchorRect(420, 96, 300, 48);
		const normalized = normalizeCatalogSearchAnchorRect(onScreen);
		expect(normalized.top).toBe(onScreen.top);
		expect(normalized.left).toBe(onScreen.left);
	});
});
