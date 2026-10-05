import { describe, expect, test } from "bun:test";

import type { CompanionActivityMessage } from "./companion-message";
import {
	postSenseProfile,
	readProfileToken,
	senseProfileBody,
	shouldSendSenseProfile,
} from "./sense-profile";

const PLAYING: CompanionActivityMessage = {
	type: "sense-companion:activity",
	service: "Netflix",
	activity: {
		details: "Stranger Things",
		state: null,
		largeImageText: null,
		smallImageKey: null,
		smallImageText: null,
		startTimestamp: null,
		endTimestamp: null,
		name: "Stranger Things",
		type: 3,
	},
	senseMedia: {
		provider: "netflix",
		kind: "episode",
		title: "Stranger Things",
		season: 4,
		episode: 1,
		positionSec: 12,
		durationSec: 3000,
	},
};

describe("sense profile", () => {
	test("playback posts the structured title", async () => {
		let seen = "";
		const result = await postSenseProfile({
			origin: "http://127.0.0.1:3001",
			token: "device-token",
			message: PLAYING,
			fetchImpl: async (url, init) => {
				seen = `${url} ${init?.headers?.authorization} ${init?.body}`;
				return { ok: true, status: 200 };
			},
		});
		expect(result).toEqual({ status: "sent", logged: null });
		expect(seen).toContain("/api/companion/now-watching");
		expect(seen).toContain("Bearer device-token");
		expect(seen).toContain('"title":"Stranger Things"');
	});

	test("a browser with nothing playing clears instead of inventing a title", () => {
		expect(
			senseProfileBody({ type: "sense-companion:clear", service: "Netflix" }),
		).toEqual({ clear: true });
	});

	test("an unpaired message is skipped", async () => {
		const result = await postSenseProfile({
			origin: "http://127.0.0.1:3001",
			token: readProfileToken({ profileToken: "" }),
			message: PLAYING,
			fetchImpl: async () => {
				throw new Error("should not fetch");
			},
		});
		expect(result).toEqual({ status: "skipped" });
	});

	test("a finished title comes back as a log notice", async () => {
		const result = await postSenseProfile({
			origin: "http://127.0.0.1:3000",
			token: "device-token",
			message: PLAYING,
			fetchImpl: async () => ({
				ok: true,
				status: 200,
				json: async () => ({
					logged: {
						logId: "log_1",
						title: "Stranger Things",
						kind: "tv",
						season: 4,
						episode: 1,
						seriesFinale: false,
					},
				}),
			}),
		});
		expect(result).toEqual({
			status: "sent",
			logged: {
				logId: "log_1",
				title: "Stranger Things",
				kind: "tv",
				season: 4,
				episode: 1,
				seriesFinale: false,
			},
		});
	});

	test("the same title waits five seconds", () => {
		expect(
			shouldSendSenseProfile({
				now: 4_000,
				lastSentAt: 0,
				lastKey: "same",
				nextKey: "same",
				minIntervalMs: 5_000,
			}),
		).toBe(false);
	});
});
