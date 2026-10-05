import { describe, expect, test } from "bun:test";

import { companionSourceId } from "./source-id";

describe("companion source id", () => {
	test("a browser keeps the same id", async () => {
		let saved = "";
		const store = {
			async get() {
				return saved || null;
			},
			async set(id: string) {
				saved = id;
			},
		};
		const first = await companionSourceId(store, () => "browser-a");
		const second = await companionSourceId(store, () => "browser-b");
		expect(first).toBe("browser-a");
		expect(second).toBe("browser-a");
	});
});
