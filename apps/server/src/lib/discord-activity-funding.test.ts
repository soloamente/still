import { beforeEach, describe, expect, mock, test } from "bun:test";

import { cachedRead } from "./redis-cache";

const countMock = mock(async () => 12);
const targetMock = mock(() => 50);
const enabledMock = mock(() => false);
const cacheRedisMock = mock(
	async () =>
		null as Awaited<ReturnType<typeof import("./redis-cache").cacheRedis>>,
);

mock.module("./count-polar-paying-subscribers", () => ({
	countPolarPayingSubscribers: countMock,
}));

mock.module("./discord-activity-pro-target", () => ({
	getDiscordActivityProTarget: targetMock,
}));

mock.module("./discord-activity-config", () => ({
	isDiscordActivityEnabled: enabledMock,
}));

mock.module("./redis-cache", () => ({
	cacheRedis: cacheRedisMock,
	cachedRead,
}));

import { getDiscordActivityFundingPayload } from "./discord-activity-funding";

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
			for (const key of keys) store.delete(key);
		},
	};
}

describe("getDiscordActivityFundingPayload", () => {
	beforeEach(() => {
		countMock.mockClear();
		targetMock.mockClear();
		enabledMock.mockClear();
		cacheRedisMock.mockClear();
		countMock.mockImplementation(async () => 12);
		targetMock.mockImplementation(() => 50);
		enabledMock.mockImplementation(() => false);
		cacheRedisMock.mockImplementation(async () => null);
	});

	test("maps count + target + production flag", async () => {
		const payload = await getDiscordActivityFundingPayload();
		expect(payload).toEqual({
			current: 12,
			target: 50,
			productionEnabled: false,
		});
	});

	test("caches only subscriber count — target and productionEnabled stay live", async () => {
		const redis = fakeRedis();
		cacheRedisMock.mockImplementation(async () => redis);

		let countCalls = 0;
		countMock.mockImplementation(async () => {
			countCalls += 1;
			return countCalls === 1 ? 12 : 99;
		});

		let enabledCalls = 0;
		enabledMock.mockImplementation(() => {
			enabledCalls += 1;
			return enabledCalls >= 2;
		});

		targetMock.mockImplementation(() => 50);

		const first = await getDiscordActivityFundingPayload();
		expect(first).toEqual({
			current: 12,
			target: 50,
			productionEnabled: false,
		});

		targetMock.mockImplementation(() => 75);

		const second = await getDiscordActivityFundingPayload();
		expect(second).toEqual({
			current: 12,
			target: 75,
			productionEnabled: true,
		});
		expect(countCalls).toBe(1);
		expect(enabledCalls).toBe(2);
	});
});
