import { describe, expect, test } from "bun:test";

import {
	DIARY_DEFAULT_LIMIT,
	DIARY_MAX_LIMIT,
	diaryOffset,
	diaryTotalPages,
	parseDiaryLimit,
	parseDiaryMedia,
	parseDiaryOrder,
	parseDiaryPage,
	parseDiaryVenue,
} from "./diary-log-query";

describe("parseDiaryMedia", () => {
	test("defaults to movie; accepts tv", () => {
		expect(parseDiaryMedia(undefined)).toBe("movie");
		expect(parseDiaryMedia("tv")).toBe("tv");
		expect(parseDiaryMedia("movie")).toBe("movie");
		expect(parseDiaryMedia("junk")).toBe("movie");
	});
});

describe("parseDiaryOrder", () => {
	test("accepts latest/earliest/title; defaults latest", () => {
		expect(parseDiaryOrder("earliest")).toBe("earliest");
		expect(parseDiaryOrder("title")).toBe("title");
		expect(parseDiaryOrder(undefined)).toBe("latest");
		expect(parseDiaryOrder("nope")).toBe("latest");
	});
});

describe("parseDiaryVenue", () => {
	test("null when unset/invalid; passes through theaters/streaming", () => {
		expect(parseDiaryVenue(undefined)).toBeNull();
		expect(parseDiaryVenue("all")).toBeNull();
		expect(parseDiaryVenue("theaters")).toBe("theaters");
		expect(parseDiaryVenue("streaming")).toBe("streaming");
	});
});

describe("page/limit/offset/totalPages", () => {
	test("page floors and clamps to >= 1", () => {
		expect(parseDiaryPage(undefined)).toBe(1);
		expect(parseDiaryPage("0")).toBe(1);
		expect(parseDiaryPage("3.9")).toBe(3);
	});
	test("limit defaults to 36 and caps at max", () => {
		expect(parseDiaryLimit(undefined)).toBe(DIARY_DEFAULT_LIMIT);
		expect(DIARY_DEFAULT_LIMIT).toBe(36);
		expect(parseDiaryLimit("9999")).toBe(DIARY_MAX_LIMIT);
		expect(parseDiaryLimit("12")).toBe(12);
	});
	test("offset and totalPages math", () => {
		expect(diaryOffset(1, 36)).toBe(0);
		expect(diaryOffset(3, 36)).toBe(72);
		expect(diaryTotalPages(0, 36)).toBe(0);
		expect(diaryTotalPages(37, 36)).toBe(2);
	});
});
