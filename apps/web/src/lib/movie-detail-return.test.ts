import { describe, expect, it } from "bun:test";

import {
	isListingDetailPath,
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
