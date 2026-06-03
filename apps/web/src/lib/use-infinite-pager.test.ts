import { describe, expect, test } from "bun:test";

import { mergeDedupe } from "./use-infinite-pager";

describe("mergeDedupe", () => {
	const key = (n: { id: string }) => n.id;
	test("appends only new keys, preserving order", () => {
		const prev = [{ id: "a" }, { id: "b" }];
		const next = [{ id: "b" }, { id: "c" }];
		expect(mergeDedupe(prev, next, key).map((x) => x.id)).toEqual([
			"a",
			"b",
			"c",
		]);
	});
	test("drops fully-duplicate batches", () => {
		const prev = [{ id: "a" }];
		expect(mergeDedupe(prev, [{ id: "a" }], key)).toHaveLength(1);
	});
});
