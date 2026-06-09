import { describe, expect, it } from "bun:test";

import {
	isListingDetailPath,
	isMeSettingsReturnHref,
	isSameProfileReturnHref,
	resolveMovieDetailReturnFromPath,
} from "./movie-detail-return";

describe("isListingDetailPath", () => {
	it("matches main film and TV detail only", () => {
		expect(isListingDetailPath("/movies/299536")).toBe(true);
		expect(isListingDetailPath("/tv/1399")).toBe(true);
		expect(isListingDetailPath("/movies/299536/credits")).toBe(false);
		expect(isListingDetailPath("/profile/adgv")).toBe(false);
	});
});

describe("resolveMovieDetailReturnFromPath", () => {
	it("maps profile with query preserved", () => {
		expect(
			resolveMovieDetailReturnFromPath(
				"/profile/adgv",
				"?tab=movies&favorites=1",
			),
		).toEqual({
			href: "/profile/adgv?tab=movies&favorites=1",
			label: "Profile",
		});
	});

	it("maps diary and lists", () => {
		expect(resolveMovieDetailReturnFromPath("/diary", "")).toEqual({
			href: "/diary",
			label: "Diary",
		});
		expect(resolveMovieDetailReturnFromPath("/lists/abc", "")).toEqual({
			href: "/lists/abc",
			label: "List",
		});
	});
});

describe("isSameProfileReturnHref", () => {
	it("treats same handle with different query as the same profile", () => {
		expect(
			isSameProfileReturnHref(
				"/profile/anselmo",
				"/profile/anselmo?tab=movies",
			),
		).toBe(true);
	});

	it("allows back to a different patron profile", () => {
		expect(isSameProfileReturnHref("/profile/anselmo", "/profile/adgv")).toBe(
			false,
		);
	});

	it("ignores non-profile current routes", () => {
		expect(isSameProfileReturnHref("/home", "/profile/anselmo")).toBe(false);
	});
});

describe("isMeSettingsReturnHref", () => {
	it("matches settings hub and sub-routes", () => {
		expect(isMeSettingsReturnHref("/me/settings")).toBe(true);
		expect(isMeSettingsReturnHref("/me/settings/profile")).toBe(true);
		expect(isMeSettingsReturnHref("/me/settings/appearance")).toBe(true);
	});

	it("ignores profile and home targets", () => {
		expect(isMeSettingsReturnHref("/profile/anselmo")).toBe(false);
		expect(isMeSettingsReturnHref("/home?browse=movies")).toBe(false);
	});
});
