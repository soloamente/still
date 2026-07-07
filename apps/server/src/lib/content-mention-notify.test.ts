import { describe, expect, test } from "bun:test";

import { extractPatronMentionHandles } from "./content-mention-handles";

describe("extractPatronMentionHandles", () => {
	test("returns unique handles from profile tokens", () => {
		expect(
			extractPatronMentionHandles(
				"Hi @[Jane](/profile/jane) and @[Bob](/profile/bob) and @[Jane](/profile/jane)",
			),
		).toEqual(["jane", "bob"]);
	});

	test("ignores people and listing tokens", () => {
		expect(
			extractPatronMentionHandles("#[Film](/movies/1) @[Tim](/people/2)"),
		).toEqual([]);
	});
});
