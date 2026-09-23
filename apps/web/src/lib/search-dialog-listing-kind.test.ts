import { describe, expect, test } from "bun:test";

import {
	cycleSearchListingKind,
	searchDialogCatalogueKind,
	searchDialogListingKindLabel,
} from "./search-dialog-listing-kind";

describe("cycleSearchListingKind", () => {
	test("cycles movie → tv → people → movie", () => {
		expect(cycleSearchListingKind("movie")).toBe("tv");
		expect(cycleSearchListingKind("tv")).toBe("people");
		expect(cycleSearchListingKind("people")).toBe("movie");
	});
});

describe("searchDialogListingKindLabel", () => {
	test("labels each mode", () => {
		expect(searchDialogListingKindLabel("movie")).toBe("Movies");
		expect(searchDialogListingKindLabel("tv")).toBe("Shows");
		expect(searchDialogListingKindLabel("people")).toBe("People");
	});
});

describe("searchDialogCatalogueKind", () => {
	test("maps people back to movies for catalogue filters", () => {
		expect(searchDialogCatalogueKind("people")).toBe("movie");
		expect(searchDialogCatalogueKind("tv")).toBe("tv");
		expect(searchDialogCatalogueKind("movie")).toBe("movie");
	});
});
