import { describe, expect, test } from "bun:test";
import {
	CONTENT_PRIVATE_CODE,
	contentPrivateCodeFromEdenError,
	contentPrivateCopy,
	contentPrivateKindFromCode,
	PROFILE_PRIVATE_CODE,
} from "./content-private";

describe("content-private web helpers", () => {
	test("parses Eden private codes", () => {
		expect(
			contentPrivateCodeFromEdenError({
				status: 403,
				value: { code: PROFILE_PRIVATE_CODE },
			}),
		).toBe(PROFILE_PRIVATE_CODE);
		expect(
			contentPrivateCodeFromEdenError({
				status: 403,
				value: { code: CONTENT_PRIVATE_CODE },
			}),
		).toBe(CONTENT_PRIVATE_CODE);
		expect(
			contentPrivateCodeFromEdenError({
				status: 404,
				value: "Not found",
			}),
		).toBeNull();
	});

	test("copy stays honest", () => {
		expect(contentPrivateCopy("profile").title).toBe("This profile is private");
		expect(contentPrivateCopy("content").body).toBe(
			"You can't access this content.",
		);
		expect(contentPrivateKindFromCode(PROFILE_PRIVATE_CODE)).toBe("profile");
	});
});
