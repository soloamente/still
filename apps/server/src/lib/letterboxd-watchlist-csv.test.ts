import { describe, expect, test } from "bun:test";

import { parseLetterboxdWatchlistCsv } from "./letterboxd-watchlist-csv";

describe("parseLetterboxdWatchlistCsv", () => {
	test("parses watchlist export", () => {
		const csv = `Date,Name,Year,Letterboxd URI
2024-03-01,Dune,2021,https://boxd.it/aBcD`;
		const rows = parseLetterboxdWatchlistCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Dune");
		expect(rows[0]?.year).toBe(2021);
		expect(rows[0]?.addedAt?.toISOString().slice(0, 10)).toBe("2024-03-01");
	});
});
