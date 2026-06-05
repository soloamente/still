import { describe, expect, test } from "bun:test";

import {
	computeTasteSignatureFromLogs,
	TASTE_SIGNATURE_VERSION,
	type TasteSignatureLogSlice,
} from "./sense-taste-signature";

function slice(
	overrides: Partial<TasteSignatureLogSlice> & { genreIds: number[] },
): TasteSignatureLogSlice {
	return {
		rating: null,
		tmdbVoteAverage: null,
		title: null,
		...overrides,
	};
}

function repeat(
	count: number,
	factory: () => TasteSignatureLogSlice,
): TasteSignatureLogSlice[] {
	return Array.from({ length: count }, factory);
}

function assertNoSecondPersonVisitor(headlineVisitor: string) {
	expect(/\bYou\b/i.test(headlineVisitor)).toBe(false);
	expect(/\byour\b/i.test(headlineVisitor)).toBe(false);
}

function assertNoScoringCopy(headline: string) {
	expect(headline.toLowerCase()).not.toContain("crowd");
	expect(headline.toLowerCase()).not.toContain("consensus");
	expect(headline.toLowerCase()).not.toContain("generous");
	expect(headline.toLowerCase()).not.toContain("hand out tens");
	expect(headline.toLowerCase()).not.toContain("trust");
}

describe("computeTasteSignatureFromLogs", () => {
	test("forming when empty", () => {
		const result = computeTasteSignatureFromLogs([]);
		expect(result.archetype).toBe("forming");
		expect(result.version).toBe(TASTE_SIGNATURE_VERSION);
		assertNoSecondPersonVisitor(result.headlineVisitor);
	});

	test("genre-purist names the dominant genre", () => {
		const result = computeTasteSignatureFromLogs(
			repeat(12, () => slice({ genreIds: [27] })),
		);
		expect(result.archetype).toBe("genre-purist");
		expect(result.headlineSelf.toLowerCase()).toContain("horror");
		assertNoScoringCopy(result.headlineSelf);
		assertNoSecondPersonVisitor(result.headlineVisitor);
	});

	test("dual-affinity names both lead genres", () => {
		const result = computeTasteSignatureFromLogs([
			...repeat(3, () => slice({ genreIds: [18] })),
			...repeat(3, () => slice({ genreIds: [16] })),
			...repeat(2, () => slice({ genreIds: [53] })),
			...repeat(2, () => slice({ genreIds: [35] })),
		]);
		expect(result.archetype).toBe("dual-affinity");
		expect(result.headlineSelf.toLowerCase()).toContain("drama");
		expect(result.headlineSelf.toLowerCase()).toContain("animation");
		assertNoScoringCopy(result.headlineSelf);
	});

	test("genre-led names top genres for moderate spread", () => {
		const result = computeTasteSignatureFromLogs([
			...repeat(3, () => slice({ genreIds: [18] })),
			...repeat(2, () => slice({ genreIds: [35] })),
			...repeat(2, () => slice({ genreIds: [53] })),
			...repeat(2, () => slice({ genreIds: [28] })),
			...repeat(2, () => slice({ genreIds: [12] })),
			...repeat(1, () => slice({ genreIds: [27] })),
		]);
		expect(result.archetype).toBe("genre-led");
		expect(result.headlineSelf.toLowerCase()).toContain("drama");
		assertNoScoringCopy(result.headlineSelf);
	});

	test("high rating gap does not override genre taste", () => {
		const result = computeTasteSignatureFromLogs(
			repeat(10, () =>
				slice({
					genreIds: [18, 16],
					rating: 90,
					tmdbVoteAverage: 6.5,
					title: "Five Feet Apart",
				}),
			),
		);
		expect(result.archetype).not.toBe("contrarian");
		expect(result.headlineSelf.toLowerCase()).toMatch(/drama|animation/);
		expect(result.headlineSelf).not.toContain("Five Feet Apart");
		assertNoScoringCopy(result.headlineSelf);
	});

	test("eclectic lists multiple genres when spread is wide", () => {
		const genres = [28, 12, 16, 35, 80, 99, 18, 14, 36, 27, 53, 37];
		const result = computeTasteSignatureFromLogs(
			genres.map((id) => slice({ genreIds: [id] })),
		);
		expect(result.archetype).toBe("eclectic");
		expect(result.headlineSelf.toLowerCase()).toMatch(
			/action|adventure|animation/,
		);
		assertNoScoringCopy(result.headlineSelf);
	});

	test("stable headline for identical input", () => {
		const slices = repeat(12, () => slice({ genreIds: [27] }));
		const a = computeTasteSignatureFromLogs(slices);
		const b = computeTasteSignatureFromLogs(slices);
		expect(a.headlineSelf).toBe(b.headlineSelf);
	});
});
