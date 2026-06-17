import { afterEach, describe, expect, mock, test } from "bun:test";

const envMock: Record<string, string | undefined> = {};

mock.module("@still/env/server", () => ({
	env: envMock,
}));

const {
	getRealtimeRedis,
	isRealtimePublishEnabled,
	realtimeStreamKey,
	resetRealtimeRedisClientForTests,
} = await import("./realtime-redis");

afterEach(() => {
	envMock.UPSTASH_REDIS_REST_URL = undefined;
	envMock.UPSTASH_REDIS_REST_TOKEN = undefined;
	resetRealtimeRedisClientForTests();
});

describe("realtime-redis", () => {
	test("disabled without Upstash env", () => {
		expect(isRealtimePublishEnabled()).toBe(false);
		expect(getRealtimeRedis()).toBeNull();
	});

	test("enabled when both Upstash keys are set", () => {
		envMock.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
		envMock.UPSTASH_REDIS_REST_TOKEN = "token";
		resetRealtimeRedisClientForTests();
		expect(isRealtimePublishEnabled()).toBe(true);
		expect(getRealtimeRedis()).not.toBeNull();
	});

	test("stream key prefixes room id", () => {
		expect(realtimeStreamKey("review:rev_1")).toBe("sense:stream:review:rev_1");
	});
});
