import { describe, expect, test } from "bun:test";
import {
	isActive,
	MOBILE_YOU_DESTINATIONS,
	shouldHideMobileTabBar,
} from "./mobile-nav";

describe("shouldHideMobileTabBar", () => {
	test("hides on movie and tv detail roots", () => {
		expect(shouldHideMobileTabBar("/movies/453405")).toBe(true);
		expect(shouldHideMobileTabBar("/tv/1399")).toBe(true);
	});
	test("shows on detail sub-pages (e.g. credits)", () => {
		expect(shouldHideMobileTabBar("/movies/453405/credits")).toBe(false);
		expect(shouldHideMobileTabBar("/tv/1399/credits")).toBe(false);
	});
	test("shows on lobby and other routes", () => {
		expect(shouldHideMobileTabBar("/home")).toBe(false);
		expect(shouldHideMobileTabBar("/diary")).toBe(false);
		expect(shouldHideMobileTabBar("/people/2888")).toBe(false);
		expect(shouldHideMobileTabBar("/lists/lst_abc")).toBe(false);
	});
});

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
	test("lists long-tail destinations not in the bar", () => {
		expect(MOBILE_YOU_DESTINATIONS.map((d) => d.href)).toEqual([
			"/diary",
			"/watchlist",
			"/quotes",
			"/lists",
			"/journal",
			"/achievements",
			"/year",
		]);
	});
	test("every destination has a non-empty label", () => {
		for (const d of MOBILE_YOU_DESTINATIONS) {
			expect(d.label.length).toBeGreaterThan(0);
		}
	});
});
