import { describe, expect, test } from "bun:test";

import {
	classifyLetterboxdFileName,
	hasRecognizedLetterboxdFile,
} from "./letterboxd-file-classifier";

describe("classifyLetterboxdFileName", () => {
	test("maps known export filenames case-insensitively", () => {
		expect(classifyLetterboxdFileName("diary.csv")).toBe("diary");
		expect(classifyLetterboxdFileName("DIARY.CSV")).toBe("diary");
		expect(classifyLetterboxdFileName("watchlist.csv")).toBe("watchlist");
		expect(classifyLetterboxdFileName("reviews.csv")).toBe("reviews");
		expect(classifyLetterboxdFileName("films.csv")).toBe("likes");
		expect(classifyLetterboxdFileName("ratings.csv")).toBe("ratings");
	});

	test("ignores unknown csv", () => {
		expect(classifyLetterboxdFileName("comments.csv")).toBe("unknown");
	});

	test("hasRecognizedLetterboxdFile allows watchlist-only", () => {
		expect(hasRecognizedLetterboxdFile(["watchlist.csv"])).toBe(true);
		expect(hasRecognizedLetterboxdFile(["comments.csv"])).toBe(false);
	});

	test("maps watched.csv", () => {
		expect(classifyLetterboxdFileName("watched.csv")).toBe("watched");
		expect(classifyLetterboxdFileName("WATCHED.CSV")).toBe("watched");
	});

	test("hasRecognizedLetterboxdFile allows watched-only", () => {
		expect(hasRecognizedLetterboxdFile(["watched.csv"])).toBe(true);
	});
});
