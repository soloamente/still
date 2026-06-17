import { describe, expect, test } from "bun:test";

import { cachedRead, invalidateCache } from "./redis-cache";

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

describe("cachedRead", () => {
	test("loads and caches on miss", async () => {
		const redis = fakeRedis();
		let calls = 0;
		const loader = async () => {
			calls += 1;
			return ["a", "b"];
		};
		const first = await cachedRead(redis, "k", 60, loader);
		const second = await cachedRead(redis, "k", 60, loader);
		expect(first).toEqual(["a", "b"]);
		expect(second).toEqual(["a", "b"]);
		expect(calls).toBe(1);
	});

	test("falls through to loader when redis is null", async () => {
		const value = await cachedRead(null, "k", 60, async () => "x");
		expect(value).toBe("x");
	});
});

describe("invalidateCache", () => {
	test("deletes the given keys", async () => {
		const redis = fakeRedis();
		redis.store.set("a", 1);
		redis.store.set("b", 2);
		await invalidateCache(redis, "a", "b");
		expect(redis.store.has("a")).toBe(false);
		expect(redis.store.has("b")).toBe(false);
	});

	test("is a no-op when redis is null", async () => {
		await expect(invalidateCache(null, "a")).resolves.toBeUndefined();
	});
});
