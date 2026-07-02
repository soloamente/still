import { describe, expect, test } from "bun:test";

import { mapElysiaErrorStatus } from "./app-on-error";

describe("mapElysiaErrorStatus", () => {
	test("NOT_FOUND maps to 404", () => {
		expect(mapElysiaErrorStatus("NOT_FOUND")).toBe(404);
	});

	test("VALIDATION maps to 422", () => {
		expect(mapElysiaErrorStatus("VALIDATION")).toBe(422);
	});

	test("unknown codes map to 500", () => {
		expect(mapElysiaErrorStatus("UNKNOWN")).toBe(500);
	});
});
