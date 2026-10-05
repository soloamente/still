import { describe, expect, test } from "bun:test";

import { aggregateTrendingCastScores } from "./search-dialog-trending-cast-people";
import type { TmdbCredit } from "./tmdb";

function cast(id: number, order: number): TmdbCredit {
	return {
		id,
		credit_id: `c-${id}`,
		name: `Person ${id}`,
		order,
		profile_path: null,
	};
}

describe("aggregateTrendingCastScores", () => {
	test("ranks actors who lead hotter titles ahead", () => {
		const rows = aggregateTrendingCastScores([
			{ cast: [cast(1, 0), cast(2, 1)], titleWeight: 4 },
			{ cast: [cast(3, 0), cast(1, 1)], titleWeight: 3 },
		]);
		expect(rows[0]?.id).toBe(1);
		expect(rows.map((row) => row.id)).toContain(3);
	});
});
