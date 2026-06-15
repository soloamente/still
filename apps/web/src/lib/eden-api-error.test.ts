import { describe, expect, test } from "bun:test";

import { edenApiErrorMessage, edenApiErrorStatus } from "./eden-api-error";

describe("edenApiErrorStatus", () => {
	test("reads numeric status from Eden errors", () => {
		expect(edenApiErrorStatus({ status: 404, value: "Movie not found" })).toBe(
			404,
		);
		expect(
			edenApiErrorStatus({ status: 503, value: "Unable to connect" }),
		).toBe(503);
	});

	test("returns null for non-Eden errors", () => {
		expect(edenApiErrorStatus(null)).toBeNull();
		expect(edenApiErrorStatus(new Error("boom"))).toBeNull();
	});
});

describe("edenApiErrorMessage", () => {
	test("prefers string error values", () => {
		expect(
			edenApiErrorMessage(
				{ status: 503, value: "Upstream offline" },
				"fallback",
			),
		).toBe("Upstream offline");
	});

	test("falls back when value is missing", () => {
		expect(edenApiErrorMessage({ status: 500 }, "fallback")).toBe("fallback");
	});
});
