import { describe, expect, test } from "bun:test";

import {
	type QuotaRedis,
	spendTranslationQuota,
	TranslationQuotaError,
	type TranslationQuotaWindow,
} from "./review-translation-quota";

/** In-memory stand-in that records TTLs so expiry behaviour is observable. */
function fakeRedis() {
	const counts = new Map<string, number>();
	const ttls = new Map<string, number>();
	const redis: QuotaRedis = {
		incr: async (key) => {
			const next = (counts.get(key) ?? 0) + 1;
			counts.set(key, next);
			return next;
		},
		expire: async (key, seconds) => {
			ttls.set(key, seconds);
		},
	};
	return { redis, counts, ttls };
}

const WINDOWS: readonly TranslationQuotaWindow[] = [
	{ name: "burst", limit: 2, windowMs: 60_000, reason: "burst" },
	{ name: "day", limit: 3, windowMs: 86_400_000, reason: "daily" },
];

describe("spendTranslationQuota", () => {
	test("allows spending up to the burst limit then rejects as burst", async () => {
		const { redis } = fakeRedis();
		const opts = { now: 1_000_000, windows: WINDOWS };
		await spendTranslationQuota(redis, "u1", opts);
		await spendTranslationQuota(redis, "u1", opts);
		const err = await spendTranslationQuota(redis, "u1", opts).catch(
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(TranslationQuotaError);
		expect((err as TranslationQuotaError).reason).toBe("burst");
	});

	test("rejects as daily once the daily window is exhausted", async () => {
		const { redis } = fakeRedis();
		// Space calls across burst windows so only the daily ceiling binds.
		await spendTranslationQuota(redis, "u1", { now: 0, windows: WINDOWS });
		await spendTranslationQuota(redis, "u1", {
			now: 61_000,
			windows: WINDOWS,
		});
		await spendTranslationQuota(redis, "u1", {
			now: 122_000,
			windows: WINDOWS,
		});
		const err = await spendTranslationQuota(redis, "u1", {
			now: 183_000,
			windows: WINDOWS,
		}).catch((e: unknown) => e);
		expect((err as TranslationQuotaError).reason).toBe("daily");
	});

	test("patrons do not share a counter", async () => {
		const { redis } = fakeRedis();
		const opts = { now: 0, windows: WINDOWS };
		await spendTranslationQuota(redis, "u1", opts);
		await spendTranslationQuota(redis, "u1", opts);
		await expect(
			spendTranslationQuota(redis, "u2", opts),
		).resolves.toBeUndefined();
	});

	test("a new window starts a fresh count", async () => {
		const { redis } = fakeRedis();
		await spendTranslationQuota(redis, "u1", { now: 0, windows: WINDOWS });
		await spendTranslationQuota(redis, "u1", { now: 1, windows: WINDOWS });
		await expect(
			spendTranslationQuota(redis, "u1", { now: 61_000, windows: WINDOWS }),
		).resolves.toBeUndefined();
	});

	test("sets an expiry on the first hit of a window only", async () => {
		const { redis, ttls } = fakeRedis();
		await spendTranslationQuota(redis, "u1", { now: 0, windows: WINDOWS });
		expect(ttls.size).toBe(2);
		const before = new Map(ttls);
		await spendTranslationQuota(redis, "u1", { now: 1, windows: WINDOWS });
		expect(new Map(ttls)).toEqual(before);
	});

	test("falls back to the in-memory limiter when redis throws", async () => {
		const broken: QuotaRedis = {
			incr: async () => {
				throw new Error("upstash down");
			},
			expire: async () => {},
		};
		const quiet = console.error;
		console.error = () => {};
		try {
			await expect(
				spendTranslationQuota(broken, "fallback-user", { windows: WINDOWS }),
			).resolves.toBeUndefined();
		} finally {
			console.error = quiet;
		}
	});

	test("works without redis at all", async () => {
		await expect(
			spendTranslationQuota(null, "no-redis-user", { windows: WINDOWS }),
		).resolves.toBeUndefined();
	});
});
