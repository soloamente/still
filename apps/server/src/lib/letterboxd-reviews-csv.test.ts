import { describe, expect, test } from "bun:test";

import {
	parseLetterboxdReviewsCsv,
	stripLetterboxdReviewHtml,
} from "./letterboxd-reviews-csv";

describe("stripLetterboxdReviewHtml", () => {
	test("converts paragraphs and strips tags", () => {
		const html = "<p>First</p><p>Second</p>";
		expect(stripLetterboxdReviewHtml(html)).toBe("First\n\nSecond");
	});

	test("returns empty for whitespace-only", () => {
		expect(stripLetterboxdReviewHtml("<p>  </p>")).toBe("");
	});
});

describe("parseLetterboxdReviewsCsv", () => {
	test("parses review body and rating", () => {
		const csv = `Name,Year,Letterboxd URI,Rating,Rewatch,Watched Date,Review
Inception,2010,https://boxd.it/abc,4.5,No,2024-01-15,"<p>Mind-bending</p>"`;
		const rows = parseLetterboxdReviewsCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.body).toBe("Mind-bending");
		expect(rows[0]?.ratingStars).toBe(4.5);
		expect(rows[0]?.watchedAt?.toISOString().slice(0, 10)).toBe("2024-01-15");
	});
});
