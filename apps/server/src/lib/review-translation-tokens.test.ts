import { describe, expect, test } from "bun:test";

import {
	MentionPlaceholderError,
	maskMentionTokens,
	restoreMentionTokens,
} from "./review-translation-tokens";

const BODY =
	"Watched #[Dune: Part Two](/movies/438631) with @[Ada](/profile/ada) — @[Denis Villeneuve](/people/1032) delivers.";

describe("maskMentionTokens", () => {
	test("replaces listing, patron and person tokens with numbered placeholders", () => {
		const { masked, tokens } = maskMentionTokens(BODY);
		expect(masked).toBe("Watched [[0]] with [[1]] — [[2]] delivers.");
		expect(tokens).toEqual([
			"#[Dune: Part Two](/movies/438631)",
			"@[Ada](/profile/ada)",
			"@[Denis Villeneuve](/people/1032)",
		]);
	});

	test("leaves bodies without mentions untouched", () => {
		const { masked, tokens } = maskMentionTokens("Just a plain review.");
		expect(masked).toBe("Just a plain review.");
		expect(tokens).toEqual([]);
	});
});

describe("restoreMentionTokens", () => {
	test("round-trips a body through a translation that reordered placeholders", () => {
		const { tokens } = maskMentionTokens(BODY);
		// Word order legitimately changes between languages.
		const translated = "[[2]] liefert — [[0]] gesehen mit [[1]].";
		expect(restoreMentionTokens(translated, tokens)).toBe(
			"@[Denis Villeneuve](/people/1032) liefert — #[Dune: Part Two](/movies/438631) gesehen mit @[Ada](/profile/ada).",
		);
	});

	test("tolerates padded placeholders", () => {
		const { tokens } = maskMentionTokens("Loved #[Dune](/movies/438631).");
		expect(restoreMentionTokens("Adoré [[ 0 ]].", tokens)).toBe(
			"Adoré #[Dune](/movies/438631).",
		);
	});

	test("is a no-op when there were no tokens", () => {
		expect(restoreMentionTokens("Une critique simple.", [])).toBe(
			"Une critique simple.",
		);
	});

	test("throws when the model dropped a placeholder", () => {
		const { tokens } = maskMentionTokens(BODY);
		expect(() => restoreMentionTokens("[[0]] und [[1]].", tokens)).toThrow(
			MentionPlaceholderError,
		);
	});

	test("throws when the model duplicated a placeholder", () => {
		const { tokens } = maskMentionTokens("Loved #[Dune](/movies/438631).");
		expect(() => restoreMentionTokens("[[0]] et [[0]].", tokens)).toThrow(
			MentionPlaceholderError,
		);
	});

	test("throws when the model invented a placeholder", () => {
		const { tokens } = maskMentionTokens("Loved #[Dune](/movies/438631).");
		expect(() => restoreMentionTokens("[[0]] et [[7]].", tokens)).toThrow(
			MentionPlaceholderError,
		);
	});
});
