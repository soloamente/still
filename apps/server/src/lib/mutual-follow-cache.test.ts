import { describe, expect, test } from "bun:test";

import { mutualFollowCacheKey } from "./mutual-follow-cache";

describe("mutualFollowCacheKey", () => {
	test("namespaces by viewer id", () => {
		expect(mutualFollowCacheKey("user_123")).toBe(
			"cache:follow:mutual:user_123",
		);
	});
});
