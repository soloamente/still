import { beforeEach, describe, expect, mock, test } from "bun:test";

const writePrefsMock = mock(async () => undefined);
const addGuildMock = mock(async () => true);
const removeGuildMock = mock(async () => true);
const fetchAccountMock = mock(
	async () =>
		null as {
			accountId: string;
			accessToken: string | null;
		} | null,
);
const deleteAccountMock = mock(async () => undefined);

const infrastructureEnabled = { value: true };

mock.module("./discord-activity-config", () => ({
	hasDiscordActivityInfrastructure: () => infrastructureEnabled.value,
}));

mock.module("./discord-profile-integration", () => ({
	writeDiscordIntegrationPreferences: writePrefsMock,
	readDiscordIntegrationPreferences: async () => ({
		discordActivityEnabled: true,
		discordPresenceGuildJoined: false,
	}),
	PROFILE_PREF_DISCORD_ACTIVITY_ENABLED: "discordActivityEnabled",
	PROFILE_PREF_DISCORD_PRESENCE_GUILD_JOINED: "discordPresenceGuildJoined",
}));

mock.module("./discord-presence-guild", () => ({
	addPatronToPresenceGuild: addGuildMock,
	removePatronFromPresenceGuild: removeGuildMock,
}));

mock.module("@still/db", () => ({
	account: { __table: "account" },
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => {
						const row = await fetchAccountMock();
						return row ? [row] : [];
					},
				}),
			}),
		}),
		delete: () => ({
			where: deleteAccountMock,
		}),
	},
}));

describe("handleDiscordAccountLinked", () => {
	let handleDiscordAccountLinked: typeof import("./discord-oauth-callback").handleDiscordAccountLinked;

	beforeEach(async () => {
		writePrefsMock.mockClear();
		addGuildMock.mockClear();
		infrastructureEnabled.value = true;

		const mod = await import("./discord-oauth-callback");
		handleDiscordAccountLinked = mod.handleDiscordAccountLinked;
	});

	test("joins guild and enables integration prefs", async () => {
		const result = await handleDiscordAccountLinked({
			userId: "usr_1",
			discordAccountId: "94490510688792576",
			accessToken: "oauth-token",
		});

		expect(result).toEqual({ guildJoined: true });
		expect(addGuildMock).toHaveBeenCalledWith(
			"94490510688792576",
			"oauth-token",
		);
		expect(writePrefsMock).toHaveBeenCalledWith("usr_1", {
			discordActivityEnabled: true,
			discordPresenceGuildJoined: true,
		});
	});

	test("skips guild join when infrastructure is disabled", async () => {
		infrastructureEnabled.value = false;

		const result = await handleDiscordAccountLinked({
			userId: "usr_1",
			discordAccountId: "94490510688792576",
			accessToken: "oauth-token",
		});

		expect(result).toEqual({ guildJoined: false });
		expect(addGuildMock).not.toHaveBeenCalled();
	});
});

describe("finishDiscordPresenceGuildSetup", () => {
	let finishDiscordPresenceGuildSetup: typeof import("./discord-oauth-callback").finishDiscordPresenceGuildSetup;

	beforeEach(async () => {
		fetchAccountMock.mockClear();
		writePrefsMock.mockClear();
		addGuildMock.mockClear();
		infrastructureEnabled.value = true;
		fetchAccountMock.mockImplementation(async () => ({
			accountId: "94490510688792576",
			accessToken: "oauth-token",
		}));

		const mod = await import("./discord-oauth-callback");
		finishDiscordPresenceGuildSetup = mod.finishDiscordPresenceGuildSetup;
	});

	test("returns NOT_LINKED when account row is missing", async () => {
		fetchAccountMock.mockImplementation(async () => null);

		expect(await finishDiscordPresenceGuildSetup("usr_1")).toEqual({
			ok: false,
			code: "NOT_LINKED",
		});
	});
});

describe("disconnectDiscordAccountForUser", () => {
	let disconnectDiscordAccountForUser: typeof import("./discord-oauth-callback").disconnectDiscordAccountForUser;

	beforeEach(async () => {
		removeGuildMock.mockClear();
		writePrefsMock.mockClear();
		deleteAccountMock.mockClear();
		fetchAccountMock.mockImplementation(async () => ({
			accountId: "94490510688792576",
			accessToken: "oauth-token",
		}));

		const mod = await import("./discord-oauth-callback");
		disconnectDiscordAccountForUser = mod.disconnectDiscordAccountForUser;
	});

	test("kicks guild member and clears prefs", async () => {
		expect(await disconnectDiscordAccountForUser("usr_1")).toBe(true);
		expect(removeGuildMock).toHaveBeenCalledWith("94490510688792576");
		expect(writePrefsMock).toHaveBeenCalledWith("usr_1", {
			discordActivityEnabled: false,
			discordPresenceGuildJoined: false,
		});
		expect(deleteAccountMock).toHaveBeenCalled();
	});
});

describe("kickDiscordPresenceGuildOnUserDelete", () => {
	let kickDiscordPresenceGuildOnUserDelete: typeof import("./discord-oauth-callback").kickDiscordPresenceGuildOnUserDelete;

	beforeEach(async () => {
		removeGuildMock.mockClear();
		infrastructureEnabled.value = true;
		fetchAccountMock.mockImplementation(async () => ({
			accountId: "94490510688792576",
			accessToken: "oauth-token",
		}));

		const mod = await import("./discord-oauth-callback");
		kickDiscordPresenceGuildOnUserDelete =
			mod.kickDiscordPresenceGuildOnUserDelete;
	});

	test("kicks linked Discord account before user delete", async () => {
		await kickDiscordPresenceGuildOnUserDelete("usr_1");

		expect(removeGuildMock).toHaveBeenCalledWith("94490510688792576");
	});

	test("no-ops when Discord is not linked", async () => {
		fetchAccountMock.mockImplementation(async () => null);

		await kickDiscordPresenceGuildOnUserDelete("usr_1");

		expect(removeGuildMock).not.toHaveBeenCalled();
	});
});
