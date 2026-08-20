import { describe, expect, test } from "bun:test";

import {
	mergeDiscordActivityEnabledPref,
	PROFILE_PREF_DISCORD_ACTIVITY_ENABLED,
	PROFILE_PREF_INTEGRATIONS,
	readDiscordActivityEnabledPref,
	sanitizeDiscordActivityPreferences,
} from "./discord-activity-preferences";

describe("readDiscordActivityEnabledPref", () => {
	test("defaults to true when missing", () => {
		expect(readDiscordActivityEnabledPref(null)).toBe(true);
		expect(readDiscordActivityEnabledPref({})).toBe(true);
	});

	test("reads explicit false", () => {
		expect(
			readDiscordActivityEnabledPref({
				integrations: { discordActivityEnabled: false },
			}),
		).toBe(false);
	});
});

describe("mergeDiscordActivityEnabledPref", () => {
	test("preserves sibling integration keys", () => {
		expect(
			mergeDiscordActivityEnabledPref(
				{
					integrations: {
						discordActivityEnabled: true,
						futureIntegration: "keep-me",
					},
				},
				false,
			),
		).toEqual({
			integrations: {
				discordActivityEnabled: false,
				futureIntegration: "keep-me",
			},
		});
	});
});

describe("sanitizeDiscordActivityPreferences", () => {
	test("deep-merges integrations on PATCH", () => {
		const result = sanitizeDiscordActivityPreferences(
			{
				[PROFILE_PREF_INTEGRATIONS]: {
					futureIntegration: "keep-me",
					[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED]: true,
				},
			},
			{
				[PROFILE_PREF_INTEGRATIONS]: {
					[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED]: false,
				},
			},
		);

		expect(result[PROFILE_PREF_INTEGRATIONS]).toEqual({
			futureIntegration: "keep-me",
			[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED]: false,
		});
	});

	test("drops invalid discordActivityEnabled values", () => {
		const result = sanitizeDiscordActivityPreferences(
			{},
			{
				[PROFILE_PREF_INTEGRATIONS]: {
					[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED]: "yes",
				},
			},
		);

		expect(result[PROFILE_PREF_INTEGRATIONS]).toEqual({});
	});
});
