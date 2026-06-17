import { afterEach, describe, expect, mock, test } from "bun:test";

const xaddMock = mock(async () => "1700000000000-0");
const expireMock = mock(async () => 1);

mock.module("@upstash/redis", () => ({
	Redis: class {
		xadd = xaddMock;
		expire = expireMock;
	},
}));

const envMock: Record<string, string | undefined> = {};

mock.module("@still/env/server", () => ({
	env: envMock,
}));

const { publishRealtimeEvent } = await import("./realtime-publish");
const { isRealtimePublishEnabled, resetRealtimeRedisClientForTests } =
	await import("./realtime-redis");

afterEach(() => {
	envMock.UPSTASH_REDIS_REST_URL = undefined;
	envMock.UPSTASH_REDIS_REST_TOKEN = undefined;
	resetRealtimeRedisClientForTests();
	xaddMock.mockClear();
	expireMock.mockClear();
});

describe("realtime-publish", () => {
	test("disabled without Upstash env", async () => {
		expect(isRealtimePublishEnabled()).toBe(false);

		await publishRealtimeEvent("review:rev_1", {
			type: "comment.created",
			commentId: "cmt_1",
			preview: "Hi",
		});

		expect(xaddMock).not.toHaveBeenCalled();
	});

	test("publishes to stream key after commit", async () => {
		envMock.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
		envMock.UPSTASH_REDIS_REST_TOKEN = "token";
		resetRealtimeRedisClientForTests();

		await publishRealtimeEvent("review:rev_1", {
			type: "comment.created",
			commentId: "cmt_1",
			preview: "Hi",
		});

		expect(xaddMock).toHaveBeenCalledTimes(1);
		const [streamKey, id, fields] = xaddMock.mock.calls[0]!;
		expect(streamKey).toBe("sense:stream:review:rev_1");
		expect(id).toBe("*");
		expect(fields).toEqual({
			data: JSON.stringify({
				type: "comment.created",
				commentId: "cmt_1",
				preview: "Hi",
			}),
		});
		expect(expireMock).toHaveBeenCalledWith(
			"sense:stream:review:rev_1",
			86_400,
		);
	});

	test("never throws when Redis publish fails", async () => {
		envMock.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
		envMock.UPSTASH_REDIS_REST_TOKEN = "token";
		resetRealtimeRedisClientForTests();
		xaddMock.mockImplementationOnce(async () => {
			throw new Error("redis down");
		});

		await expect(
			publishRealtimeEvent("user:usr_1:inbox", {
				type: "notification.created",
				notificationId: "ntf_1",
				kind: "review.like",
			}),
		).resolves.toBeUndefined();
	});
});
