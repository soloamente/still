import { describe, expect, test } from "bun:test";

import { searchDialogGenreIconKey } from "./search-dialog-genre-icon";

describe("searchDialogGenreIconKey", () => {
	test("maps Figma genre labels to distinct keys", () => {
		expect(searchDialogGenreIconKey("Fantasy")).toBe("fantasy");
		expect(searchDialogGenreIconKey("Action")).toBe("action");
		expect(searchDialogGenreIconKey("Horror")).toBe("horror");
		expect(searchDialogGenreIconKey("Romance")).toBe("romance");
		expect(searchDialogGenreIconKey("Adventure")).toBe("adventure");
		expect(searchDialogGenreIconKey("Animation")).toBe("animation");
		expect(searchDialogGenreIconKey("Anime")).toBe("anime");
		expect(searchDialogGenreIconKey("Thriller")).toBe("thriller");
		expect(searchDialogGenreIconKey("Science Fiction")).toBe("scifi");
		expect(searchDialogGenreIconKey("Documentary")).toBe("documentary");
	});

	test("falls back for unknown labels", () => {
		expect(searchDialogGenreIconKey("TV Movie")).toBe("default");
	});
});
