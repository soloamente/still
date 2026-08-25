import { describe, expect, test } from "bun:test";
import {
	CATALOGUE_HORIZONTAL_POSTER_RAIL_SCROLL_CLASSNAME,
	cataloguePosterHoverShellClassName,
} from "./catalogue-poster-hover";

describe("CATALOGUE_HORIZONTAL_POSTER_RAIL_SCROLL_CLASSNAME", () => {
	test("scrolls on a separate node from the avatar group and keeps a top gutter for lift", () => {
		expect(CATALOGUE_HORIZONTAL_POSTER_RAIL_SCROLL_CLASSNAME).toContain(
			"overflow-x-auto",
		);
		expect(CATALOGUE_HORIZONTAL_POSTER_RAIL_SCROLL_CLASSNAME).toContain("pt-3");
		expect(CATALOGUE_HORIZONTAL_POSTER_RAIL_SCROLL_CLASSNAME).not.toContain(
			"t-avatar-group",
		);
	});
});

describe("cataloguePosterHoverShellClassName", () => {
	test("uses transitions.dev avatar-group item class instead of a hover shadow", () => {
		const className = cataloguePosterHoverShellClassName("catalogue");
		expect(className).toContain("t-avatar");
		expect(className).not.toContain("hover:shadow-");
		expect(className).not.toContain("focus-within:shadow-");
	});

	test("keeps drawer tiles under sheet scrims", () => {
		expect(cataloguePosterHoverShellClassName("sheet")).toContain(
			"hover:z-[1]",
		);
		expect(cataloguePosterHoverShellClassName("catalogue")).toContain(
			"hover:z-[100]",
		);
	});
});
