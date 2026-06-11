import { describe, expect, test } from "bun:test";

import { isShareableAppPath } from "./shareable-app-paths";

describe("isShareableAppPath", () => {
	test("allows film, TV, profile, and people detail routes", () => {
		expect(isShareableAppPath("/movies/550")).toBe(true);
		expect(isShareableAppPath("/movies/550/credits")).toBe(true);
		expect(isShareableAppPath("/tv/1399")).toBe(true);
		expect(isShareableAppPath("/profile/ada")).toBe(true);
		expect(isShareableAppPath("/people/287")).toBe(true);
	});

	test("blocks authenticated-only app routes", () => {
		expect(isShareableAppPath("/home")).toBe(false);
		expect(isShareableAppPath("/diary")).toBe(false);
		expect(isShareableAppPath("/lists/abc")).toBe(false);
		expect(isShareableAppPath("/sign-in")).toBe(false);
	});
});
