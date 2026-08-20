import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const envMock: Record<string, string | undefined> = {
	DISCORD_BOT_TOKEN: "bot-token",
	DISCORD_PRESENCE_GUILD_ID: "guild-123",
};

mock.module("@still/env/server", () => ({
	env: envMock,
}));

const discordUserId = "94490510688792576";
const oauthAccessToken = "oauth-access-token";

let lastRequest: {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
} | null = null;

const originalFetch = globalThis.fetch;

beforeEach(() => {
	lastRequest = null;
	globalThis.fetch = mock(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const headers = new Headers(init?.headers);
			lastRequest = {
				url: String(input),
				method: init?.method ?? "GET",
				headers: Object.fromEntries(headers.entries()),
				body: typeof init?.body === "string" ? init.body : undefined,
			};

			return new Response(null, { status: 204 });
		},
	) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	envMock.DISCORD_BOT_TOKEN = "bot-token";
	envMock.DISCORD_PRESENCE_GUILD_ID = "guild-123";
});

describe("addPatronToPresenceGuild", () => {
	test("returns false when bot env is missing", async () => {
		envMock.DISCORD_BOT_TOKEN = undefined;
		const { addPatronToPresenceGuild } = await import("./discord-guild-member");

		expect(
			await addPatronToPresenceGuild(discordUserId, oauthAccessToken),
		).toBe(false);
		expect(lastRequest).toBeNull();
	});

	test("PUTs guild member with OAuth access token", async () => {
		const { addPatronToPresenceGuild } = await import("./discord-guild-member");

		expect(
			await addPatronToPresenceGuild(discordUserId, oauthAccessToken),
		).toBe(true);

		expect(lastRequest).toEqual({
			url: `https://discord.com/api/v10/guilds/guild-123/members/${discordUserId}`,
			method: "PUT",
			headers: {
				accept: "application/json",
				authorization: "Bot bot-token",
				"content-type": "application/json",
			},
			body: JSON.stringify({ access_token: oauthAccessToken }),
		});
	});
});

describe("removePatronFromPresenceGuild", () => {
	test("DELETEs guild member with bot authorization", async () => {
		const { removePatronFromPresenceGuild } = await import(
			"./discord-guild-member"
		);

		expect(await removePatronFromPresenceGuild(discordUserId)).toBe(true);

		expect(lastRequest).toEqual({
			url: `https://discord.com/api/v10/guilds/guild-123/members/${discordUserId}`,
			method: "DELETE",
			headers: {
				accept: "application/json",
				authorization: "Bot bot-token",
			},
			body: undefined,
		});
	});

	test("returns false when guild id is missing", async () => {
		envMock.DISCORD_PRESENCE_GUILD_ID = undefined;
		const { removePatronFromPresenceGuild } = await import(
			"./discord-guild-member"
		);

		expect(await removePatronFromPresenceGuild(discordUserId)).toBe(false);
		expect(lastRequest).toBeNull();
	});
});

describe("discordPresenceGuildMemberUrlForTests", () => {
	test("builds the guild member REST URL from env", async () => {
		const { discordPresenceGuildMemberUrlForTests } = await import(
			"./discord-guild-member"
		);

		expect(discordPresenceGuildMemberUrlForTests(discordUserId)).toBe(
			`https://discord.com/api/v10/guilds/guild-123/members/${discordUserId}`,
		);
	});
});
