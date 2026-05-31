import { describe, expect, test } from "bun:test";

import {
	isClientProductEventKind,
	isProductEventKind,
} from "./product-event-kinds";

describe("product-event-kinds", () => {
	test("accepts server funnel kinds", () => {
		expect(isProductEventKind("log.first_created")).toBe(true);
		expect(isProductEventKind("import.letterboxd.completed")).toBe(true);
		expect(isProductEventKind("import.anilist.completed")).toBe(true);
	});

	test("rejects unknown kinds", () => {
		expect(isProductEventKind("log.created")).toBe(false);
	});

	test("client subset is narrower", () => {
		expect(isClientProductEventKind("taste_card.shared")).toBe(true);
		expect(isClientProductEventKind("log.first_created")).toBe(false);
	});
});
