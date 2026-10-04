import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const files = [
	"apps/server/src/lib/taste-matched-discovery.ts",
	"apps/server/src/lib/taste-matched-discovery-tv.ts",
	"apps/server/src/lib/watchlist-tonight-signals.ts",
];

describe("taste profile diary load", () => {
	test("profile queries do not cap the diary at 400", () => {
		for (const file of files) {
			const source = readFileSync(file, "utf8");
			expect(source.includes(".limit(400)")).toBe(false);
		}
	});

	test("movie taste profile query scopes to movie logs", () => {
		const source = readFileSync(files[0], "utf8");
		expect(source.includes("isNotNull(log.movieId)")).toBe(true);
	});
});
