import { describe, expect, test } from "bun:test";

import {
	isCompanionRelay,
	isDiscordStatusRequest,
} from "./companion-message.ts";

describe("discord status request", () => {
	test("matches only the setup ping", () => {
		expect(
			isDiscordStatusRequest({ type: "sense-companion:discord-status" }),
		).toBe(true);
		expect(isDiscordStatusRequest({ type: "sense-companion:relay" })).toBe(
			false,
		);
		expect(isCompanionRelay({ type: "sense-companion:discord-status" })).toBe(
			false,
		);
	});
});
