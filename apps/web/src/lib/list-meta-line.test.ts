import { describe, expect, test } from "vitest";

import { formatListMetaLine } from "./list-meta-line";

const priv = { isPublic: false };
const pub = { isPublic: true };

describe("formatListMetaLine", () => {
	test("empty", () => {
		expect(
			formatListMetaLine({ movieItemsCount: 0, tvItemsCount: 0, ...priv }),
		).toBe("0 titles · Private");
	});

	test("films only plural", () => {
		expect(
			formatListMetaLine({ movieItemsCount: 12, tvItemsCount: 0, ...priv }),
		).toBe("12 films · Private");
	});

	test("one film", () => {
		expect(
			formatListMetaLine({ movieItemsCount: 1, tvItemsCount: 0, ...priv }),
		).toBe("1 film · Private");
	});

	test("shows only", () => {
		expect(
			formatListMetaLine({ movieItemsCount: 0, tvItemsCount: 4, ...pub }),
		).toBe("4 shows · Public");
	});

	test("one show", () => {
		expect(
			formatListMetaLine({ movieItemsCount: 0, tvItemsCount: 1, ...priv }),
		).toBe("1 show · Private");
	});

	test("mixed", () => {
		expect(
			formatListMetaLine({ movieItemsCount: 8, tvItemsCount: 4, ...priv }),
		).toBe("8 films · 4 shows · Private");
	});
});
