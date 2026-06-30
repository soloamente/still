import { describe, expect, test } from "bun:test";

import { castCrewMetaLine } from "./cast-crew-search-query";

describe("castCrewMetaLine", () => {
	test("joins department and known-for titles", () => {
		expect(
			castCrewMetaLine({
				id: 1,
				name: "Christopher Nolan",
				profileUrl: null,
				knownForDepartment: "Directing",
				knownForTitles: ["Inception", "Oppenheimer"],
			}),
		).toBe("Directing · Inception, Oppenheimer");
	});

	test("department only when no titles", () => {
		expect(
			castCrewMetaLine({
				id: 2,
				name: "X",
				profileUrl: null,
				knownForDepartment: "Acting",
				knownForTitles: [],
			}),
		).toBe("Acting");
	});

	test("titles only when no department", () => {
		expect(
			castCrewMetaLine({
				id: 3,
				name: "Y",
				profileUrl: null,
				knownForDepartment: null,
				knownForTitles: ["Heat"],
			}),
		).toBe("Heat");
	});

	test("empty string when nothing to show", () => {
		expect(
			castCrewMetaLine({
				id: 4,
				name: "Z",
				profileUrl: null,
				knownForDepartment: null,
				knownForTitles: [],
			}),
		).toBe("");
	});
});
