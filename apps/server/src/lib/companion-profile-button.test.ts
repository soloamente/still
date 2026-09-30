import { describe, expect, test } from "bun:test";

import { companionProfileButtonUrl } from "./companion-profile-button";

describe("companionProfileButtonUrl", () => {
	test("builds an https profile link", () => {
		expect(
			companionProfileButtonUrl({
				origin: "https://sense.example",
				handle: "ada",
				isPrivate: false,
			}),
		).toBe("https://sense.example/profile/ada");
	});

	test("omits a private profile, a missing handle, and a non-https origin", () => {
		expect(
			companionProfileButtonUrl({
				origin: "https://sense.example",
				handle: "ada",
				isPrivate: true,
			}),
		).toBeNull();
		expect(
			companionProfileButtonUrl({
				origin: "https://sense.example",
				handle: "  ",
				isPrivate: false,
			}),
		).toBeNull();
		expect(
			companionProfileButtonUrl({
				origin: "http://127.0.0.1:3001",
				handle: "ada",
				isPrivate: false,
			}),
		).toBeNull();
	});
});
