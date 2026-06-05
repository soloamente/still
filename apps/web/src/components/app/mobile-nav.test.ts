import { describe, expect, test } from "bun:test";
import { isActive, MOBILE_YOU_DESTINATIONS } from "./mobile-nav";

describe("isActive", () => {
	test("exact match is active", () => {
		expect(isActive("/home", "/home")).toBe(true);
		expect(isActive("/notifications", "/notifications")).toBe(true);
	});
	test("prefixed child route is active for non-home", () => {
		expect(isActive("/notifications/abc", "/notifications")).toBe(true);
	});
	test("home does NOT match other routes by prefix", () => {
		expect(isActive("/homestead", "/home")).toBe(false);
		expect(isActive("/diary", "/home")).toBe(false);
	});
	test("unrelated route is not active", () => {
		expect(isActive("/diary", "/notifications")).toBe(false);
	});
});

describe("MOBILE_YOU_DESTINATIONS", () => {
	test("lists the six long-tail destinations not in the bar", () => {
		expect(MOBILE_YOU_DESTINATIONS.map((d) => d.href)).toEqual([
			"/diary",
			"/watchlist",
			"/lists",
			"/news",
			"/chat",
			"/achievements",
		]);
	});
	test("every destination has a non-empty label", () => {
		for (const d of MOBILE_YOU_DESTINATIONS) {
			expect(d.label.length).toBeGreaterThan(0);
		}
	});
});
