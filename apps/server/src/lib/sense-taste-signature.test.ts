import { describe, expect, test } from "bun:test";

import {
	computeTasteSignatureFromLogs,
	type TasteSignatureLogSlice,
} from "./sense-taste-signature";

describe("computeTasteSignatureFromLogs", () => {
	test("returns low-confidence placeholder when empty", () => {
		const result = computeTasteSignatureFromLogs([]);
		expect(result.confidence).toBe("low");
		expect(result.headline).toContain("learning your taste");
	});

	test("summarizes dominant genres with enough logs", () => {
		const slices: TasteSignatureLogSlice[] = Array.from({ length: 12 }, () => ({
			genreIds: [27, 53],
			rating: 85,
			tmdbVoteAverage: 6.5,
			title: "Hereditary",
		}));
		const result = computeTasteSignatureFromLogs(slices);
		expect(result.headline.toLowerCase()).toContain("horror");
		expect(result.confidence).toBe("medium");
	});
});
