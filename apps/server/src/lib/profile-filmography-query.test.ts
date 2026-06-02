import { describe, expect, test } from "bun:test";

import {
	FILMOGRAPHY_DEFAULT_LIMIT,
	FILMOGRAPHY_MAX_LIMIT,
	filmographyOffset,
	filmographyTotalPages,
	parseFilmographyFavorites,
	parseFilmographyLimit,
	parseFilmographyMedia,
	parseFilmographyOrder,
	parseFilmographyPage,
	parseFilmographyVenue,
} from "./profile-filmography-query";

describe("parseFilmographyMedia", () => {
	test("defaults to movie; accepts tv", () => {
		expect(parseFilmographyMedia(undefined)).toBe("movie");
		expect(parseFilmographyMedia("tv")).toBe("tv");
		expect(parseFilmographyMedia("movie")).toBe("movie");
		expect(parseFilmographyMedia("junk")).toBe("movie");
	});
});

describe("parseFilmographyOrder", () => {
	test("accepts latest/earliest/title; defaults latest", () => {
		expect(parseFilmographyOrder("earliest")).toBe("earliest");
		expect(parseFilmographyOrder("title")).toBe("title");
		expect(parseFilmographyOrder(undefined)).toBe("latest");
		expect(parseFilmographyOrder("nope")).toBe("latest");
	});
});

describe("parseFilmographyVenue", () => {
	test("theaters/streaming pass; everything else is null (all venues)", () => {
		expect(parseFilmographyVenue("theaters")).toBe("theaters");
		expect(parseFilmographyVenue("streaming")).toBe("streaming");
		expect(parseFilmographyVenue(undefined)).toBe(null);
		expect(parseFilmographyVenue("all")).toBe(null);
	});
});

describe("parseFilmographyFavorites", () => {
	test("1/true/yes → true; else false", () => {
		expect(parseFilmographyFavorites("1")).toBe(true);
		expect(parseFilmographyFavorites("true")).toBe(true);
		expect(parseFilmographyFavorites("yes")).toBe(true);
		expect(parseFilmographyFavorites(undefined)).toBe(false);
		expect(parseFilmographyFavorites("0")).toBe(false);
	});
});

describe("parseFilmographyPage", () => {
	test("defaults/floors", () => {
		expect(parseFilmographyPage(undefined)).toBe(1);
		expect(parseFilmographyPage("0")).toBe(1);
		expect(parseFilmographyPage("4.8")).toBe(4);
	});
});

describe("parseFilmographyLimit", () => {
	test("default + clamp", () => {
		expect(parseFilmographyLimit(undefined)).toBe(FILMOGRAPHY_DEFAULT_LIMIT);
		expect(parseFilmographyLimit("0")).toBe(FILMOGRAPHY_DEFAULT_LIMIT);
		expect(parseFilmographyLimit("9999")).toBe(FILMOGRAPHY_MAX_LIMIT);
		expect(parseFilmographyLimit("20")).toBe(20);
	});
});

describe("filmographyOffset / filmographyTotalPages", () => {
	test("offset + ceil", () => {
		expect(filmographyOffset(1, 48)).toBe(0);
		expect(filmographyOffset(3, 48)).toBe(96);
		expect(filmographyTotalPages(0, 48)).toBe(0);
		expect(filmographyTotalPages(48, 48)).toBe(1);
		expect(filmographyTotalPages(49, 48)).toBe(2);
	});
});
