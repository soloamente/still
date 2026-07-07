import { describe, expect, test } from "bun:test";

import {
	extractMovieMentionCredits,
	filterMentionCreditsByQuery,
} from "@/lib/movie-mention-credits";

describe("movie mention credits", () => {
	test("extracts cast then key crew up to cap", () => {
		const rows = extractMovieMentionCredits({
			credits: {
				cast: [
					{ id: 1, name: "A", profile_path: null, order: 0 },
					{ id: 2, name: "B", profile_path: "/p.jpg", order: 1 },
				],
				crew: [
					{ id: 3, name: "Director", job: "Director", profile_path: null },
				],
			},
		});
		expect(rows.map((row) => row.name)).toEqual(["A", "B", "Director"]);
	});

	test("filters by case-insensitive substring", () => {
		const rows = filterMentionCreditsByQuery(
			[
				{ id: 1, name: "Timothée Chalamet", profileUrl: null, role: "Cast" },
				{ id: 2, name: "Zendaya", profileUrl: null, role: "Cast" },
			],
			"tim",
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Timothée Chalamet");
	});
});
