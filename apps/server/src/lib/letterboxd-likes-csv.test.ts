import { describe, expect, test } from "bun:test";

import { parseLetterboxdLikesCsv } from "./letterboxd-likes-csv";

describe("parseLetterboxdLikesCsv", () => {
	test("parses liked films export", () => {
		const csv = `Date,Name,Year,Letterboxd URI
2024-06-10,Parasite,2019,https://boxd.it/parasite`;
		const rows = parseLetterboxdLikesCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Parasite");
		expect(rows[0]?.year).toBe(2019);
		expect(rows[0]?.letterboxdUri).toBe("https://boxd.it/parasite");
	});
});
