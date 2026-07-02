import { describe, expect, test } from "bun:test";

import {
	MAX_PINNED_QUOTES,
	normalizePinnedQuoteSaveIds,
	removePinnedQuoteSaveId,
} from "./profile-pinned-quotes";

describe("normalizePinnedQuoteSaveIds", () => {
	test("dedupes and caps at max pins", () => {
		const ids = Array.from({ length: 5 }, (_, i) => `save_${i}`);
		expect(normalizePinnedQuoteSaveIds(ids)).toHaveLength(MAX_PINNED_QUOTES);
		expect(normalizePinnedQuoteSaveIds(["a", "a", "b"])).toEqual(["a", "b"]);
	});

	test("removePinnedQuoteSaveId drops one id", () => {
		expect(removePinnedQuoteSaveId(["a", "b"], "a")).toEqual(["b"]);
	});
});
