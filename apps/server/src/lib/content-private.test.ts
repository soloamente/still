import { describe, expect, test } from "bun:test";
import {
	CONTENT_PRIVATE_CODE,
	contentPrivatePayload,
	isContentPrivatePayload,
	PROFILE_PRIVATE_CODE,
} from "./content-private";

describe("contentPrivatePayload", () => {
	test("profile kind returns PROFILE_PRIVATE with clear copy", () => {
		const body = contentPrivatePayload("profile");
		expect(body.code).toBe(PROFILE_PRIVATE_CODE);
		expect(body.error).toBe("This profile is private");
		expect(body.message).toBe("You can't access this profile");
	});

	test("content kind returns CONTENT_PRIVATE with clear copy", () => {
		const body = contentPrivatePayload("content");
		expect(body.code).toBe(CONTENT_PRIVATE_CODE);
		expect(body.error).toBe("This content is private");
		expect(body.message).toBe("You can't access this content");
	});

	test("isContentPrivatePayload accepts both codes only", () => {
		expect(isContentPrivatePayload(contentPrivatePayload("profile"))).toBe(
			true,
		);
		expect(isContentPrivatePayload(contentPrivatePayload("content"))).toBe(
			true,
		);
		expect(isContentPrivatePayload({ code: "PLAN_FEATURE_REQUIRED" })).toBe(
			false,
		);
		expect(isContentPrivatePayload("Not found")).toBe(false);
		expect(isContentPrivatePayload(null)).toBe(false);
	});
});
