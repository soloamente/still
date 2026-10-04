import { describe, expect, test } from "bun:test";

import { readTextSwapDurationMs } from "./run-text-state-swap";

describe("readTextSwapDurationMs", () => {
	test("falls back to 150 when there is no document", () => {
		expect(readTextSwapDurationMs()).toBe(150);
	});
});
