import { describe, expect, test } from "bun:test";

import type { SenseMedia } from "../presence/activity-log";
import { memoryCompanionTokenStore } from "./client";
import {
	companionHeartbeatKey,
	companionMediaReadyToLog,
	postCompanionNowWatching,
	shouldSendCompanionHeartbeat,
} from "./now-watching";

const MEDIA: SenseMedia = {
	provider: "netflix",
	kind: "episode",
	title: "Stranger Things",
	season: 1,
	episode: 2,
	positionSec: 30,
	durationSec: 3600,
};

describe("shouldSendCompanionHeartbeat", () => {
	test("sends the first tick and a title change immediately", () => {
		expect(
			shouldSendCompanionHeartbeat({
				now: 1_000,
				lastSentAt: null,
				lastKey: null,
				nextKey: "netflix|episode|stranger things|false",
				minIntervalMs: 5_000,
			}),
		).toBe(true);
		expect(
			shouldSendCompanionHeartbeat({
				now: 2_000,
				lastSentAt: 1_000,
				lastKey: "netflix|episode|stranger things|false",
				nextKey: "netflix|episode|the matrix|false",
				minIntervalMs: 5_000,
			}),
		).toBe(true);
	});

	test("holds position-only ticks for five seconds", () => {
		const key = companionHeartbeatKey({
			clear: false,
			media: MEDIA,
			paused: false,
		});
		expect(
			shouldSendCompanionHeartbeat({
				now: 2_000,
				lastSentAt: 1_000,
				lastKey: key,
				nextKey: key,
				minIntervalMs: 5_000,
			}),
		).toBe(false);
		expect(
			shouldSendCompanionHeartbeat({
				now: 6_000,
				lastSentAt: 1_000,
				lastKey: key,
				nextKey: key,
				minIntervalMs: 5_000,
			}),
		).toBe(true);
	});
});

describe("companionMediaReadyToLog", () => {
	test("the last tenth of a long film forces a heartbeat", () => {
		expect(
			companionMediaReadyToLog({
				...MEDIA,
				kind: "movie",
				season: null,
				episode: null,
				positionSec: 6500,
				durationSec: 7200,
			}),
		).toBe(true);
	});
});

describe("postCompanionNowWatching", () => {
	test("posts the device token and the structured media", async () => {
		const store = memoryCompanionTokenStore("device-token");
		let seen = "";
		const result = await postCompanionNowWatching({
			origin: "http://127.0.0.1:3001",
			store,
			media: MEDIA,
			paused: false,
			fetchImpl: async (url, init) => {
				seen = `${url} ${init?.headers?.authorization} ${init?.body}`;
				return new Response(JSON.stringify({ watching: {} }), { status: 200 });
			},
		});
		expect(result.status).toBe("sent");
		expect(result.logged).toBeNull();
		expect(seen).toContain("http://127.0.0.1:3001/api/companion/now-watching");
	});

	test("reads a nested logged payload from the API", async () => {
		const store = memoryCompanionTokenStore("device-token");
		const result = await postCompanionNowWatching({
			origin: "http://127.0.0.1:3001",
			store,
			media: { ...MEDIA, kind: "movie", season: null, episode: null },
			paused: false,
			fetchImpl: async () =>
				new Response(
					JSON.stringify({
						watching: {},
						logged: {
							logId: "log_abc",
							title: "Am I OK?",
							kind: "movie",
							season: null,
							episode: null,
							seriesFinale: false,
						},
					}),
					{ status: 200 },
				),
		});
		expect(result.logged).toEqual({
			logId: "log_abc",
			title: "Am I OK?",
			kind: "movie",
			season: null,
			episode: null,
			seriesFinale: false,
		});
	});

	test("skips the request when the extension is not paired", async () => {
		const store = memoryCompanionTokenStore();
		let called = false;
		const result = await postCompanionNowWatching({
			origin: "http://127.0.0.1:3001",
			store,
			media: MEDIA,
			paused: false,
			fetchImpl: async () => {
				called = true;
				return new Response("nope");
			},
		});
		expect(result.status).toBe("skipped");
		expect(called).toBe(false);
	});
});
