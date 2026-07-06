import { describe, expect, test } from "bun:test";
import { TASTE_SIGNATURE_VERSION } from "./sense-taste-signature";
import { isStaleTasteSignature } from "./taste-signature-cache";

/** Minimal v4 payload shape — matches what recompute persists on profile. */
function tasteV4Fixture(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		archetype: "genre-led",
		headlineSelf: "Drama leads the diary.",
		headlineVisitor: "Drama leads the diary.",
		headline: "Drama leads the diary.",
		confidence: "medium",
		version: TASTE_SIGNATURE_VERSION,
		pillLabel: "Dramatist",
		pillGenres: { primary: "Drama", secondary: "Comedy" },
		...overrides,
	};
}

describe("isStaleTasteSignature", () => {
	test("null or missing object is stale", () => {
		expect(isStaleTasteSignature(null)).toBe(true);
		expect(isStaleTasteSignature(undefined)).toBe(true);
	});

	test("version 3 rows are stale (triggers lazy v4 recompute)", () => {
		expect(
			isStaleTasteSignature(
				tasteV4Fixture({
					version: 3,
					pillLabel: undefined,
					pillGenres: undefined,
				}),
			),
		).toBe(true);
	});

	test("version 4 rows with persona fields are fresh", () => {
		expect(isStaleTasteSignature(tasteV4Fixture())).toBe(false);
	});

	test("version 4 without pillLabel is stale for pill-showing archetypes", () => {
		expect(
			isStaleTasteSignature(
				tasteV4Fixture({ pillLabel: undefined, pillGenres: undefined }),
			),
		).toBe(true);
		expect(
			isStaleTasteSignature(
				tasteV4Fixture({
					archetype: "eclectic",
					pillLabel: undefined,
					pillGenres: undefined,
				}),
			),
		).toBe(true);
	});

	test("version 4 without pillLabel is fresh for non-pill archetypes", () => {
		expect(
			isStaleTasteSignature(
				tasteV4Fixture({
					archetype: "generous",
					pillLabel: undefined,
					pillGenres: undefined,
				}),
			),
		).toBe(false);
	});

	test("missing archetype or visitor headline is stale", () => {
		expect(isStaleTasteSignature(tasteV4Fixture({ archetype: "" }))).toBe(true);
		expect(isStaleTasteSignature(tasteV4Fixture({ headlineVisitor: "" }))).toBe(
			true,
		);
	});
});
