import { describe, expect, test } from "bun:test";

import {
	companionButtonOrigin,
	companionProfileButtonUrl,
	companionTitleButtonUrl,
	SENSE_PUBLIC_PROFILE_ORIGIN,
} from "./companion-profile-button";

describe("companionButtonOrigin", () => {
	test("keeps an https site and replaces localhost", () => {
		expect(companionButtonOrigin("https://cinema.sense.fans")).toBe(
			"https://cinema.sense.fans",
		);
		expect(companionButtonOrigin("http://localhost:3001")).toBe(
			SENSE_PUBLIC_PROFILE_ORIGIN,
		);
	});
});

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

describe("companionTitleButtonUrl", () => {
	test("builds an https title link and skips http", () => {
		expect(
			companionTitleButtonUrl("https://cinema.sense.fans", "/movies/550"),
		).toBe("https://cinema.sense.fans/movies/550");
		expect(
			companionTitleButtonUrl("http://127.0.0.1:3001", "/movies/550"),
		).toBeNull();
		expect(
			companionTitleButtonUrl("https://cinema.sense.fans", null),
		).toBeNull();
	});
});
