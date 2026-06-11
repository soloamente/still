import { describe, expect, test } from "bun:test";

import { rankTasteNeighbors } from "./taste-neighbor-discovery";

describe("rankTasteNeighbors", () => {
	test("followed tier ranks above stranger at equal compatibility", () => {
		const ranked = rankTasteNeighbors([
			{ userId: "a", compatibilityPercent: 70, tier: 2 },
			{ userId: "b", compatibilityPercent: 70, tier: 1 },
		]);
		expect(ranked[0]?.userId).toBe("b");
	});
});
