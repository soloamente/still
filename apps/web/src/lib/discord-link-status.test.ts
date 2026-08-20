import { describe, expect, test } from "bun:test";

import {
	discordLinkStatusCopy,
	formatAtHandle,
	resolveDiscordLinkVisualState,
} from "./discord-link-status";

describe("resolveDiscordLinkVisualState", () => {
	test("idle when Discord is not linked", () => {
		expect(
			resolveDiscordLinkVisualState({
				connected: false,
				guildJoined: false,
				activityEnabled: true,
			}),
		).toBe("idle");
	});

	test("setup when linked but guild join failed", () => {
		expect(
			resolveDiscordLinkVisualState({
				connected: true,
				guildJoined: false,
				activityEnabled: true,
			}),
		).toBe("setup");
	});

	test("active when linked, in guild, and showing on profile", () => {
		expect(
			resolveDiscordLinkVisualState({
				connected: true,
				guildJoined: true,
				activityEnabled: true,
			}),
		).toBe("active");
	});

	test("connected when linked but activity is hidden", () => {
		expect(
			resolveDiscordLinkVisualState({
				connected: true,
				guildJoined: true,
				activityEnabled: false,
			}),
		).toBe("connected");
	});
});

describe("discordLinkStatusCopy", () => {
	test("active footer names Discord as the source", () => {
		expect(discordLinkStatusCopy("active").pill).toBe("Synced");
		expect(discordLinkStatusCopy("active").footer).toContain(
			"Discord as source",
		);
	});

	test("idle pill is not connected", () => {
		expect(discordLinkStatusCopy("idle").pill).toBe("Not connected");
	});

	test("pending and locked cover pre-production and Still-tier", () => {
		expect(discordLinkStatusCopy("pending").pill).toBe("Soon");
		expect(discordLinkStatusCopy("locked").pill).toBe("Pro");
	});
});

describe("formatAtHandle", () => {
	test("prefixes a bare handle", () => {
		expect(formatAtHandle("anselmo")).toBe("@anselmo");
	});

	test("keeps an existing at-sign", () => {
		expect(formatAtHandle("@anselmo")).toBe("@anselmo");
	});

	test("returns empty when missing", () => {
		expect(formatAtHandle("  ")).toBe("");
		expect(formatAtHandle(null)).toBe("");
	});
});
