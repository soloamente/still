import { describe, expect, test } from "bun:test";

import { normalizeMovieQuotesRocksRow } from "./moviequotes-provider";

describe("normalizeMovieQuotesRocksRow", () => {
	test("maps content, speaker, and external id", () => {
		expect(
			normalizeMovieQuotesRocksRow(
				{
					id: 166,
					content: "Yippie-ki-yay, motherfucker!",
					year: 1988,
					character: { name: "John McClane" },
				},
				1988,
			),
		).toEqual({
			externalId: "166",
			body: "Yippie-ki-yay, motherfucker!",
			speaker: "John McClane",
		});
	});

	test("filters quotes from a different release year", () => {
		expect(
			normalizeMovieQuotesRocksRow(
				{ id: 1, content: "Hello", year: 1933 },
				1999,
			),
		).toBeNull();
	});

	test("allows missing quote year", () => {
		expect(
			normalizeMovieQuotesRocksRow({ id: 2, content: "Hello" }, 1999),
		)?.toMatchObject({ externalId: "2", body: "Hello" });
	});
});
