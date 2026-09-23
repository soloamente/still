import { describe, expect, test } from "bun:test";

import {
	searchDialogEmptyFoundCopy,
	searchDialogFoundCopy,
	searchDialogTabHint,
} from "./search-dialog-results-copy";

describe("searchDialogFoundCopy", () => {
	test("uses movie/movies found", () => {
		expect(searchDialogFoundCopy("movie", 515)).toEqual({
			countLabel: "515",
			foundLabel: "movies found",
		});
		expect(searchDialogFoundCopy("movie", 1)).toEqual({
			countLabel: "1",
			foundLabel: "movie found",
		});
	});

	test("uses show/shows found", () => {
		expect(searchDialogFoundCopy("tv", 2)).toEqual({
			countLabel: "2",
			foundLabel: "shows found",
		});
		expect(searchDialogFoundCopy("tv", 1)).toEqual({
			countLabel: "1",
			foundLabel: "show found",
		});
	});

	test("uses list/lists found", () => {
		expect(searchDialogFoundCopy("lists", 0)).toEqual({
			countLabel: "0",
			foundLabel: "lists found",
		});
		expect(searchDialogFoundCopy("lists", 1)).toEqual({
			countLabel: "1",
			foundLabel: "list found",
		});
	});

	test("uses person/people found", () => {
		expect(searchDialogFoundCopy("people", 3)).toEqual({
			countLabel: "3",
			foundLabel: "people found",
		});
		expect(searchDialogFoundCopy("people", 1)).toEqual({
			countLabel: "1",
			foundLabel: "person found",
		});
	});
});

describe("searchDialogEmptyFoundCopy", () => {
	test("uses result/results found", () => {
		expect(searchDialogEmptyFoundCopy(12)).toEqual({
			countLabel: "12",
			foundLabel: "results found",
		});
		expect(searchDialogEmptyFoundCopy(1)).toEqual({
			countLabel: "1",
			foundLabel: "result found",
		});
	});
});

describe("searchDialogTabHint", () => {
	test("points Tab at the next catalogue", () => {
		expect(searchDialogTabHint("movie")).toBe("to search shows");
		expect(searchDialogTabHint("tv")).toBe("to search people");
		expect(searchDialogTabHint("people")).toBe("to search movies");
	});

	test("empty discovery uses change category", () => {
		expect(searchDialogTabHint("movie", { empty: true })).toBe(
			"to change category",
		);
	});
});
