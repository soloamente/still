import { describe, expect, test } from "bun:test";

import {
	buildPersonDetailInfoCards,
	computePersonAgeYears,
	formatTmdbGenderLabel,
	normalizeTmdbPersonDate,
} from "./person-detail-facts";

describe("formatTmdbGenderLabel", () => {
	test("maps TMDb gender codes", () => {
		expect(formatTmdbGenderLabel(0)).toBeNull();
		expect(formatTmdbGenderLabel(1)).toBe("Female");
		expect(formatTmdbGenderLabel(2)).toBe("Male");
		expect(formatTmdbGenderLabel(3)).toBe("Non-binary");
	});
});

describe("normalizeTmdbPersonDate", () => {
	test("converts Eden Date revival to YYYY-MM-DD", () => {
		expect(normalizeTmdbPersonDate(new Date(Date.UTC(2002, 8, 27, 12)))).toBe(
			"2002-09-27",
		);
	});
});

describe("computePersonAgeYears", () => {
	test("counts full birthdays", () => {
		expect(computePersonAgeYears("2002-09-27", "2026-07-07")).toBe(23);
		expect(computePersonAgeYears("2002-09-27", "2002-09-28")).toBe(0);
	});

	test("returns null for year-only birthdays", () => {
		expect(computePersonAgeYears("2002", "2026-07-07")).toBeNull();
	});
});

describe("buildPersonDetailInfoCards", () => {
	test("builds Jenna Ortega-style cards", () => {
		const cards = buildPersonDetailInfoCards({
			birthday: "2002-09-27",
			deathday: null,
			placeOfBirth: "Coachella Valley, Palm Desert, California, USA",
			gender: 1,
			knownForDepartment: "Acting",
		});

		expect(cards.map((c) => c.id)).toEqual([
			"born",
			"age",
			"born-in",
			"gender",
		]);
		expect(cards.find((c) => c.id === "born")?.value).toBe("Sep 27, 2002");
		expect(cards.find((c) => c.id === "born-in")?.value).toContain(
			"California",
		);
	});

	test("includes died card for deceased people", () => {
		const cards = buildPersonDetailInfoCards({
			birthday: "1929-04-16",
			deathday: "1993-02-24",
			placeOfBirth: "Detroit, Michigan, USA",
			gender: 2,
			knownForDepartment: "Acting",
		});

		expect(cards.some((c) => c.id === "died")).toBe(true);
		expect(cards.find((c) => c.id === "age")?.label).toBe("Age at death");
	});

	test("builds cards when birthday is a Date", () => {
		const cards = buildPersonDetailInfoCards({
			birthday: new Date(Date.UTC(2002, 8, 27, 12)),
			deathday: null,
			placeOfBirth: "California, USA",
			gender: 1,
		});

		expect(cards.find((c) => c.id === "born")?.value).toBe("Sep 27, 2002");
	});
});
