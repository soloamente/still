import { describe, expect, test } from "bun:test";

import { resolveQuoteAttribution } from "./quote-attribution";

describe("resolveQuoteAttribution", () => {
	test("shows timestamp and speaker when both are present", () => {
		expect(
			resolveQuoteAttribution({
				speaker: "Tyler Durden",
				timestampLabel: "01:02:03",
			}),
		).toEqual({
			speaker: "Tyler Durden",
			timestampLabel: "01:02:03",
		});
	});

	test("shows speaker without timestamp", () => {
		expect(
			resolveQuoteAttribution({
				speaker: "Tyler Durden",
				timestampLabel: null,
			}),
		).toEqual({
			speaker: "Tyler Durden",
			timestampLabel: null,
		});
	});

	test("shows timestamp without speaker", () => {
		expect(
			resolveQuoteAttribution({
				speaker: null,
				timestampLabel: "00:13:54",
			}),
		).toEqual({
			speaker: null,
			timestampLabel: "00:13:54",
		});
	});

	test("returns empty attribution when nothing should render", () => {
		expect(
			resolveQuoteAttribution({
				speaker: null,
				timestampLabel: null,
			}),
		).toEqual({
			speaker: null,
			timestampLabel: null,
		});
	});
});
