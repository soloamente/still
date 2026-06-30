import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	markMonthRecapSeen,
	readMonthRecapSeen,
	shouldShowMonthRecap,
} from "./month-recap-seen";

const USER = "user-test-1";
const MONTH = "2026-06";

function installLocalStorageMock() {
	const store = new Map<string, string>();
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
			clear: () => {
				store.clear();
			},
		},
		configurable: true,
	});
	return store;
}

describe("month-recap-seen", () => {
	beforeEach(() => {
		installLocalStorageMock();
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, "localStorage");
	});

	test("defaults to unseen", () => {
		expect(readMonthRecapSeen(USER, MONTH)).toBe(false);
		expect(shouldShowMonthRecap(USER, MONTH)).toBe(true);
	});

	test("persists acknowledged month key", () => {
		markMonthRecapSeen(USER, MONTH);
		expect(readMonthRecapSeen(USER, MONTH)).toBe(true);
		expect(shouldShowMonthRecap(USER, MONTH)).toBe(false);
		expect(shouldShowMonthRecap(USER, "2026-07")).toBe(true);
	});
});
