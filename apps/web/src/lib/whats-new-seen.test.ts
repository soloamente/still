import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	markWhatsNewSeen,
	readWhatsNewSeenReleaseId,
	shouldShowWhatsNewRelease,
} from "./whats-new-seen";

const USER = "user-test-1";

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

describe("whats-new-seen", () => {
	beforeEach(() => {
		installLocalStorageMock();
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, "localStorage");
	});

	test("defaults to unseen", () => {
		expect(readWhatsNewSeenReleaseId(USER)).toBeNull();
		expect(shouldShowWhatsNewRelease(USER, "2026-06-05")).toBe(true);
	});

	test("persists acknowledged release id", () => {
		markWhatsNewSeen(USER, "2026-06-05");
		expect(readWhatsNewSeenReleaseId(USER)).toBe("2026-06-05");
		expect(shouldShowWhatsNewRelease(USER, "2026-06-05")).toBe(false);
		expect(shouldShowWhatsNewRelease(USER, "2026-06-06")).toBe(true);
	});
});
