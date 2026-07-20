import { describe, expect, test } from "bun:test";

import {
	festivalIconPrestigeRank,
	resolveFestivalIconFromAwardLabel,
} from "./movie-festival-recognition";

describe("resolveFestivalIconFromAwardLabel", () => {
	test("maps Oscars and BAFTA labels", () => {
		expect(
			resolveFestivalIconFromAwardLabel("Academy Award for Best Actor"),
		).toBe("oscars");
		expect(
			resolveFestivalIconFromAwardLabel("BAFTA Award for Best Direction"),
		).toBe("bafta");
	});

	test("falls back to generic award", () => {
		expect(resolveFestivalIconFromAwardLabel("Obscure Critics Prize")).toBe(
			"award",
		);
	});
});

describe("festivalIconPrestigeRank", () => {
	test("oscars rank above generic award", () => {
		expect(festivalIconPrestigeRank("oscars")).toBeLessThan(
			festivalIconPrestigeRank("award"),
		);
	});
});
