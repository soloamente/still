import { describe, expect, test } from "bun:test";

import {
	assertEmailVerified,
	emailVerificationRequiredBody,
	isPublicContentVisibility,
} from "./require-verified-email";

describe("assertEmailVerified", () => {
	test("passes when emailVerified is true", () => {
		expect(() =>
			assertEmailVerified({ id: "u1", emailVerified: true }),
		).not.toThrow();
	});

	test("throws EMAIL_VERIFICATION_REQUIRED when false", () => {
		expect(() =>
			assertEmailVerified({ id: "u1", emailVerified: false }),
		).toThrow("EMAIL_VERIFICATION_REQUIRED");
	});

	test("throws when emailVerified is undefined", () => {
		expect(() => assertEmailVerified({ id: "u1" })).toThrow(
			"EMAIL_VERIFICATION_REQUIRED",
		);
	});
});

describe("emailVerificationRequiredBody", () => {
	test("returns stable code for clients", () => {
		expect(emailVerificationRequiredBody()).toEqual({
			error: "Verify your email to do that",
			code: "EMAIL_VERIFICATION_REQUIRED",
		});
	});
});

describe("isPublicContentVisibility", () => {
	test("only public visibility is gated", () => {
		expect(isPublicContentVisibility("public")).toBe(true);
		expect(isPublicContentVisibility("private")).toBe(false);
		expect(isPublicContentVisibility("followers")).toBe(false);
	});
});
