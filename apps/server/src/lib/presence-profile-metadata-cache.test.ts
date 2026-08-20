import { describe, expect, test } from "bun:test";

import {
	fetchPublicPresenceProfilesByHandles,
	presenceProfileByHandleCacheKey,
} from "./presence-profile-metadata-cache";
import { cachedRead } from "./redis-cache";

function fakeRedis() {
	const store = new Map<string, unknown>();
	return {
		store,
		get: async <T>(key: string): Promise<T | null> =>
			store.has(key) ? (store.get(key) as T) : null,
		set: async (key: string, value: unknown) => {
			store.set(key, value);
		},
		del: async (...keys: string[]) => {
			for (const k of keys) store.delete(k);
		},
	};
}

describe("presenceProfileByHandleCacheKey", () => {
	test("normalizes handle casing", () => {
		expect(presenceProfileByHandleCacheKey("AdGV")).toBe(
			"cache:presence:profile:handle:adgv",
		);
	});
});

describe("fetchPublicPresenceProfilesByHandles", () => {
	test("returns empty for no handles", async () => {
		expect(await fetchPublicPresenceProfilesByHandles([])).toEqual([]);
	});

	test("cachedRead stores per-handle metadata on miss path", async () => {
		const redis = fakeRedis();
		const loader = async () => ({
			userId: "usr_1",
			handle: "adgv",
			preferences: { privacy: { presenceVisibility: "public" } },
			isPrivate: false,
		});

		const first = await cachedRead(
			redis,
			presenceProfileByHandleCacheKey("adgv"),
			60,
			loader,
		);
		const second = await cachedRead(
			redis,
			presenceProfileByHandleCacheKey("adgv"),
			60,
			async () => {
				throw new Error("should not load twice");
			},
		);

		expect(first?.userId).toBe("usr_1");
		expect(second?.userId).toBe("usr_1");
	});
});
