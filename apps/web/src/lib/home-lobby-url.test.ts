import { describe, expect, test } from "bun:test";
import { isBareHomeLobbySearchParams } from "./home-lobby-cookie";
import { buildHomeLobbyHref } from "./home-lobby-url";

describe("buildHomeLobbyHref", () => {
	test("Latest chip includes sort=latest so bare /home does not restore Popular from cookie", () => {
		expect(buildHomeLobbyHref({ browse: "movies", sort: "latest" })).toBe(
			"/home?sort=latest",
		);
		expect(isBareHomeLobbySearchParams({ sort: "latest" })).toBe(false);
	});

	test("Popular still serializes sort=popular", () => {
		expect(buildHomeLobbyHref({ browse: "movies", sort: "popular" })).toBe(
			"/home?sort=popular",
		);
	});
});
