import { describe, expect, test } from "bun:test";

import { isTmdbCdnUrl, tmdbPosterUrlFromPath } from "./tmdb-poster-url";

describe("tmdbPosterUrlFromPath", () => {
	test("prefixes relative paths with the requested size", () => {
		expect(tmdbPosterUrlFromPath("/abc.jpg", "w342")).toBe(
			"https://image.tmdb.org/t/p/w342/abc.jpg",
		);
	});

	test("passes through absolute URLs unchanged", () => {
		expect(tmdbPosterUrlFromPath("https://cdn.example/cover.jpg", "w342")).toBe(
			"https://cdn.example/cover.jpg",
		);
	});
});

describe("isTmdbCdnUrl", () => {
	test("detects TMDb CDN hosts", () => {
		expect(isTmdbCdnUrl("https://image.tmdb.org/t/p/w342/abc.jpg")).toBe(true);
		expect(isTmdbCdnUrl("http://image.tmdb.org/t/p/w92/x.png")).toBe(true);
	});

	test("rejects non-TMDb and empty values", () => {
		expect(isTmdbCdnUrl(null)).toBe(false);
		expect(isTmdbCdnUrl("")).toBe(false);
		expect(
			isTmdbCdnUrl("https://public.blob.vercel-storage.com/avatar.png"),
		).toBe(false);
		expect(isTmdbCdnUrl("/local/poster.jpg")).toBe(false);
	});
});
