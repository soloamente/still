import { afterEach, describe, expect, mock, test } from "bun:test";

const envMock: Record<string, string | undefined> = {};

mock.module("@still/env/server", () => ({
	env: envMock,
}));

const {
	hasDiscordActivityInfrastructure,
	isDiscordActivityEnabled,
	isDiscordActivityFeatureFlagEnabled,
} = await import("./discord-activity-config");

const fullInfra = {
	DISCORD_CLIENT_ID: "client-id",
	DISCORD_CLIENT_SECRET: "client-secret",
	DISCORD_BOT_TOKEN: "bot-token",
	DISCORD_PRESENCE_GUILD_ID: "guild-id",
	LANYARD_INTERNAL_URL: "http://lanyard:4001",
} as const;

afterEach(() => {
	for (const key of Object.keys(envMock)) {
		delete envMock[key];
	}
});

describe("isDiscordActivityFeatureFlagEnabled", () => {
	test("false when flag unset", () => {
		expect(isDiscordActivityFeatureFlagEnabled()).toBe(false);
	});

	test("true for affirmative flag values", () => {
		envMock.DISCORD_ACTIVITY_ENABLED = "true";
		expect(isDiscordActivityFeatureFlagEnabled()).toBe(true);
		envMock.DISCORD_ACTIVITY_ENABLED = "1";
		expect(isDiscordActivityFeatureFlagEnabled()).toBe(true);
	});
});

describe("hasDiscordActivityInfrastructure", () => {
	test("false when any required var is missing", () => {
		Object.assign(envMock, fullInfra);
		delete envMock.LANYARD_INTERNAL_URL;
		expect(hasDiscordActivityInfrastructure()).toBe(false);
	});

	test("true when all vars are set", () => {
		Object.assign(envMock, fullInfra);
		expect(hasDiscordActivityInfrastructure()).toBe(true);
	});
});

describe("isDiscordActivityEnabled", () => {
	test("false without flag even when infra is complete", () => {
		Object.assign(envMock, fullInfra);
		expect(isDiscordActivityEnabled()).toBe(false);
	});

	test("false with flag when infra is incomplete", () => {
		envMock.DISCORD_ACTIVITY_ENABLED = "true";
		expect(isDiscordActivityEnabled()).toBe(false);
	});

	test("true when flag and infra are both present", () => {
		Object.assign(envMock, fullInfra);
		envMock.DISCORD_ACTIVITY_ENABLED = "true";
		expect(isDiscordActivityEnabled()).toBe(true);
	});
});
