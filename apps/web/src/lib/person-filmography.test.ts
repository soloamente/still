import { describe, expect, test } from "bun:test";

import {
	type PersonFilmographyRow,
	sortFilmographyByYearDesc,
} from "./person-filmography";

function row(releaseDate: string | null, title: string): PersonFilmographyRow {
	return {
		tmdbId: 0,
		mediaKind: "movie",
		title,
		posterUrl: null,
		releaseDate,
		roles: [],
	};
}

describe("sortFilmographyByYearDesc", () => {
	test("orders newest year first", () => {
		const out = sortFilmographyByYearDesc([
			row("2010-07-16", "Inception"),
			row("2023-07-21", "Oppenheimer"),
			row("2014-11-07", "Interstellar"),
		]);
		expect(out.map((r) => r.title)).toEqual([
			"Oppenheimer",
			"Interstellar",
			"Inception",
		]);
	});

	test("puts entries without a parseable year last", () => {
		const out = sortFilmographyByYearDesc([
			row(null, "Untitled"),
			row("2020-01-01", "Tenet"),
		]);
		expect(out.map((r) => r.title)).toEqual(["Tenet", "Untitled"]);
	});

	test("is stable for equal years (keeps input order)", () => {
		const out = sortFilmographyByYearDesc([
			row("2010-12-01", "B"),
			row("2010-01-01", "A"),
		]);
		expect(out.map((r) => r.title)).toEqual(["B", "A"]);
	});

	test("does not mutate the input array", () => {
		const input = [row("2001-01-01", "X"), row("2009-01-01", "Y")];
		const snapshot = input.map((r) => r.title);
		sortFilmographyByYearDesc(input);
		expect(input.map((r) => r.title)).toEqual(snapshot);
	});
});
