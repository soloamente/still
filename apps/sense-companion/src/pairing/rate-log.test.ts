import { describe, expect, test } from "bun:test";

import { isCompanionRateRequest, postCompanionLogRating } from "./rate-log";

describe("postCompanionLogRating", () => {
	test("posts the score with the pairing token", async () => {
		let seen = "";
		const ok = await postCompanionLogRating({
			store: {
				get: async () => "device-token",
				set: async () => {},
				clear: async () => {},
			},
			logId: "log_1",
			rating: 8.5,
			origin: "http://127.0.0.1:3000",
			fetchImpl: async (url, init) => {
				seen = `${url} ${init?.headers?.authorization} ${init?.body}`;
				return { ok: true, status: 200 };
			},
		});
		expect(ok).toBe(true);
		expect(seen).toContain("/api/companion/log-rating");
		expect(seen).toContain("Bearer device-token");
		expect(seen).toContain('"rating":8.5');
	});

	test("a rating request is not a playback message", () => {
		expect(
			isCompanionRateRequest({
				type: "sense-companion:rate-log",
				id: "1",
				logId: "log_1",
				rating: 8,
			}),
		).toBe(true);
		expect(isCompanionRateRequest({ type: "sense-companion:activity" })).toBe(
			false,
		);
	});
});
