import { describe, expect, test } from "bun:test";
import { tmdbPosterUrlFromPath } from "./tmdb-poster-url";

describe("tmdbPosterUrlFromPath", () => {
	test("builds an absolute URL from a TMDb path", () => {
		expect(tmdbPosterUrlFromPath("/abc.jpg")).toBe(
			"https://image.tmdb.org/t/p/w185/abc.jpg",
		);
	});
	test("adds a leading slash when missing", () => {
		expect(tmdbPosterUrlFromPath("abc.jpg")).toBe(
			"https://image.tmdb.org/t/p/w185/abc.jpg",
		);
	});
	test("honors an explicit size", () => {
		expect(tmdbPosterUrlFromPath("/abc.jpg", "w342")).toBe(
			"https://image.tmdb.org/t/p/w342/abc.jpg",
		);
	});
	test("passes through absolute URLs untouched", () => {
		expect(tmdbPosterUrlFromPath("https://example.com/x.png")).toBe(
			"https://example.com/x.png",
		);
	});
	test("returns null for empty/nullish", () => {
		expect(tmdbPosterUrlFromPath(null)).toBeNull();
		expect(tmdbPosterUrlFromPath("")).toBeNull();
		expect(tmdbPosterUrlFromPath(undefined)).toBeNull();
	});
});
