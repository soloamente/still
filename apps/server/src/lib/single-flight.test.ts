import { describe, expect, test } from "bun:test";

import { type SingleFlightRedis, singleFlight } from "./single-flight";

function fakeRedis(initial: Record<string, unknown> = {}) {
	const store = new Map<string, unknown>(Object.entries(initial));
	const redis: SingleFlightRedis = {
		get: async <T>(key: string) => (store.get(key) as T | undefined) ?? null,
		set: async (key, value, opts) => {
			if (opts?.nx && store.has(key)) return null;
			store.set(key, value);
			return "OK";
		},
		del: async (...keys) => {
			for (const key of keys) store.delete(key);
		},
	};
	return { redis, store };
}

/** Virtual clock so polling loops finish instantly and deterministically. */
function clock() {
	let t = 0;
	return {
		now: () => t,
		sleep: async (ms: number) => {
			t += ms;
		},
	};
}

const BASE = {
	lockKey: "lock",
	resultKey: "result",
	lockTtlSec: 60,
	waitMs: 1_000,
	pollMs: 100,
};

describe("singleFlight", () => {
	test("runs directly when there is no redis", async () => {
		const value = await singleFlight({
			...BASE,
			redis: null,
			run: async () => "done",
		});
		expect(value).toBe("done");
	});

	test("leader runs once and releases the lock", async () => {
		const { redis, store } = fakeRedis();
		let runs = 0;
		const value = await singleFlight({
			...BASE,
			redis,
			run: async () => {
				runs += 1;
				return "fresh";
			},
		});
		expect(value).toBe("fresh");
		expect(runs).toBe(1);
		expect(store.has("lock")).toBe(false);
	});

	test("releases the lock when the work throws", async () => {
		const { redis, store } = fakeRedis();
		await expect(
			singleFlight({
				...BASE,
				redis,
				run: async () => {
					throw new Error("model down");
				},
			}),
		).rejects.toThrow("model down");
		expect(store.has("lock")).toBe(false);
	});

	test("a follower returns the leader's result without running", async () => {
		const { redis, store } = fakeRedis({ lock: "1" });
		const c = clock();
		let runs = 0;
		// Leader finishes while the follower is polling.
		let polls = 0;
		const original = redis.get;
		redis.get = async <T>(key: string) => {
			polls += 1;
			if (polls === 3) store.set("result", "from-leader");
			return original<T>(key);
		};
		const value = await singleFlight({
			...BASE,
			redis,
			...c,
			run: async () => {
				runs += 1;
				return "own";
			},
		});
		expect(value).toBe("from-leader");
		expect(runs).toBe(0);
	});

	test("a follower does the work itself if the leader never delivers", async () => {
		const { redis } = fakeRedis({ lock: "1" });
		const c = clock();
		const value = await singleFlight({
			...BASE,
			redis,
			...c,
			run: async () => "own",
		});
		expect(value).toBe("own");
		expect(c.now()).toBeGreaterThanOrEqual(1_000);
	});

	test("an unreachable lock store degrades to running the work", async () => {
		const redis: SingleFlightRedis = {
			get: async () => null,
			set: async () => {
				throw new Error("down");
			},
			del: async () => {},
		};
		const value = await singleFlight({
			...BASE,
			redis,
			run: async () => "own",
		});
		expect(value).toBe("own");
	});
});
