import { describe, expect, test } from "bun:test";

import { isStillApiErrorPayload } from "./still-api-error-payload";

describe("isStillApiErrorPayload", () => {
	test("detects Elysia NOT_FOUND body", () => {
		expect(
			isStillApiErrorPayload({ error: "NOT_FOUND", code: "NOT_FOUND" }),
		).toBe(true);
	});

	test("rejects successful title-logo payload", () => {
		expect(isStillApiErrorPayload({ logoPath: "/abc.png" })).toBe(false);
	});

	test("rejects null logoPath payload", () => {
		expect(isStillApiErrorPayload({ logoPath: null })).toBe(false);
	});
});
