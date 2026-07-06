import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	markSenseSupportCampaignSeen,
	shouldShowSenseSupportCampaign,
} from "./sense-support-campaign-seen";

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

describe("sense-support-campaign-seen", () => {
	beforeEach(() => {
		installLocalStorageMock();
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, "localStorage");
	});

	test("shows when unseen", () => {
		expect(
			shouldShowSenseSupportCampaign("user-1", "sense-growth-2026-07"),
		).toBe(true);
	});

	test("hides after mark seen", () => {
		markSenseSupportCampaignSeen("user-1", "sense-growth-2026-07");
		expect(
			shouldShowSenseSupportCampaign("user-1", "sense-growth-2026-07"),
		).toBe(false);
	});
});
