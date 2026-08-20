import { describe, expect, mock, test } from "bun:test";

const payloadMock = mock(async () => ({
	current: 12,
	target: 50,
	productionEnabled: false,
}));

mock.module("../lib/discord-activity-funding", () => ({
	getDiscordActivityFundingPayload: payloadMock,
}));

import { discordActivityFundingRoute } from "./discord-activity-funding";

describe("GET /api/discord-activity/funding", () => {
	test("returns 200 with current, target, and productionEnabled only", async () => {
		const res = await discordActivityFundingRoute.handle(
			new Request("http://test/api/discord-activity/funding"),
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(Object.keys(body).sort()).toEqual([
			"current",
			"productionEnabled",
			"target",
		]);
		expect(typeof body.current).toBe("number");
		expect(typeof body.target).toBe("number");
		expect(typeof body.productionEnabled).toBe("boolean");
		expect(body).toEqual({
			current: 12,
			target: 50,
			productionEnabled: false,
		});
	});
});
