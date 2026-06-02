import { describe, expect, test } from "bun:test";

import { resolveProfileTabFromCounts } from "./profile-lobby-derive";

describe("resolveProfileTabFromCounts", () => {
	const counts = { movies: 3, tv: 2 };
	test("honors explicit valid tab", () => {
		expect(resolveProfileTabFromCounts("tv", ["lists"], counts)).toBe("tv");
		expect(resolveProfileTabFromCounts("lists", ["lists"], counts)).toBe(
			"lists",
		);
	});
	test("'filmography' maps to movies when present, else tv", () => {
		expect(resolveProfileTabFromCounts("filmography", [], counts)).toBe(
			"movies",
		);
		expect(
			resolveProfileTabFromCounts("filmography", [], { movies: 0, tv: 5 }),
		).toBe("tv");
	});
	test("falls back to movies, then tv, then first social tab", () => {
		expect(resolveProfileTabFromCounts(undefined, [], counts)).toBe("movies");
		expect(
			resolveProfileTabFromCounts(undefined, [], { movies: 0, tv: 4 }),
		).toBe("tv");
		expect(
			resolveProfileTabFromCounts(undefined, ["reviews"], { movies: 0, tv: 0 }),
		).toBe("reviews");
	});
});
