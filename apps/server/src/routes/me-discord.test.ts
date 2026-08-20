import { beforeEach, describe, expect, mock, test } from "bun:test";

import { computePatronEntitlements } from "../lib/patron-entitlements";
import { buildMeDiscordRoute } from "./me-discord";

const finishSetupMock = mock(async () => ({
	ok: true as const,
	guildJoined: true,
}));
const disconnectMock = mock(async () => true);
const statusMock = mock(async () => ({
	connected: true,
	guildJoined: false,
	discordActivityEnabled: true,
	discordUsername: null as string | null,
}));
const featureEnabledMock = mock(() => true);

mock.module("../lib/discord-activity-config", () => ({
	isDiscordActivityEnabled: featureEnabledMock,
}));

mock.module("../lib/discord-oauth-callback", () => ({
	finishDiscordPresenceGuildSetup: finishSetupMock,
	disconnectDiscordAccountForUser: disconnectMock,
	readDiscordLinkStatusForUser: statusMock,
}));

mock.module("../lib/discord-activity-metadata-cache", () => ({
	invalidateDiscordActivityMetadata: mock(async () => {}),
}));

const entitlementByUser = new Map<
	string,
	{ subscriptionTier: "still" | "attuned"; planOverride?: "attuned" | null }
>();

mock.module("../lib/patron-entitlements", () => ({
	loadPatronEntitlements: async (userId: string) => {
		const row = entitlementByUser.get(userId) ?? {
			subscriptionTier: "still" as const,
			planOverride: null,
		};
		return computePatronEntitlements({
			subscriptionTier: row.subscriptionTier,
			planOverride: row.planOverride ?? null,
			featureGrantKeys: [],
		});
	},
}));

const USER_ID = "usr_me";

function makeApp(user: { id: string } | null) {
	return buildMeDiscordRoute({
		deriveUser: () => user,
	});
}

function setEntitlement(
	userId: string,
	tier: "still" | "attuned",
	planOverride: "attuned" | null = null,
) {
	entitlementByUser.set(userId, { subscriptionTier: tier, planOverride });
}

describe("POST /api/me/discord/finish-setup", () => {
	beforeEach(() => {
		finishSetupMock.mockClear();
		featureEnabledMock.mockReturnValue(true);
		entitlementByUser.clear();
		setEntitlement(USER_ID, "attuned");
		finishSetupMock.mockImplementation(async () => ({
			ok: true as const,
			guildJoined: true,
		}));
	});

	test("401 when signed out", async () => {
		const res = await makeApp(null).handle(
			new Request("http://test/api/me/discord/finish-setup", {
				method: "POST",
			}),
		);
		expect(res.status).toBe(401);
	});

	test("returns guildJoined payload for signed-in Attuned patron", async () => {
		const res = await makeApp({ id: USER_ID }).handle(
			new Request("http://test/api/me/discord/finish-setup", {
				method: "POST",
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, guildJoined: true });
	});

	test("403 PLAN_FEATURE_REQUIRED for Still patron when production is on", async () => {
		setEntitlement(USER_ID, "still");

		const res = await makeApp({ id: USER_ID }).handle(
			new Request("http://test/api/me/discord/finish-setup", {
				method: "POST",
			}),
		);

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({
			error: "Discord activity is included with Pro",
			code: "PLAN_FEATURE_REQUIRED",
			featureKey: "discord_activity",
		});
		expect(finishSetupMock).not.toHaveBeenCalled();
	});

	test("404 when feature is disabled", async () => {
		featureEnabledMock.mockReturnValue(false);

		const res = await makeApp({ id: USER_ID }).handle(
			new Request("http://test/api/me/discord/finish-setup", {
				method: "POST",
			}),
		);

		expect(res.status).toBe(404);
	});
});

describe("DELETE /api/me/discord", () => {
	beforeEach(() => {
		disconnectMock.mockClear();
		featureEnabledMock.mockReturnValue(true);
		entitlementByUser.clear();
		setEntitlement(USER_ID, "attuned");
		disconnectMock.mockImplementation(async () => true);
	});

	test("disconnects linked Discord account for Attuned patron", async () => {
		const res = await makeApp({ id: USER_ID }).handle(
			new Request("http://test/api/me/discord", { method: "DELETE" }),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(disconnectMock).toHaveBeenCalledWith(USER_ID);
	});

	test("403 PLAN_FEATURE_REQUIRED for Still patron when production is on", async () => {
		setEntitlement(USER_ID, "still");

		const res = await makeApp({ id: USER_ID }).handle(
			new Request("http://test/api/me/discord", { method: "DELETE" }),
		);

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({
			error: "Discord activity is included with Pro",
			code: "PLAN_FEATURE_REQUIRED",
			featureKey: "discord_activity",
		});
		expect(disconnectMock).not.toHaveBeenCalled();
	});
});

describe("GET /api/me/discord/status", () => {
	beforeEach(() => {
		featureEnabledMock.mockReturnValue(true);
		entitlementByUser.clear();
	});

	test("returns disabled shape when feature flag is off", async () => {
		featureEnabledMock.mockReturnValue(false);

		const res = await makeApp({ id: USER_ID }).handle(
			new Request("http://test/api/me/discord/status"),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			featureEnabled: false,
			connected: false,
			guildJoined: false,
			discordActivityEnabled: false,
			discordUsername: null,
		});
	});

	test("returns canUseDiscordActivity false for Still patron when production is on", async () => {
		setEntitlement(USER_ID, "still");

		const res = await makeApp({ id: USER_ID }).handle(
			new Request("http://test/api/me/discord/status"),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			featureEnabled: true,
			canUseDiscordActivity: false,
			connected: true,
			guildJoined: false,
			discordActivityEnabled: true,
			discordUsername: null,
		});
	});

	test("returns canUseDiscordActivity true for Attuned patron when production is on", async () => {
		setEntitlement(USER_ID, "attuned");

		const res = await makeApp({ id: USER_ID }).handle(
			new Request("http://test/api/me/discord/status"),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			featureEnabled: true,
			canUseDiscordActivity: true,
			connected: true,
			guildJoined: false,
			discordActivityEnabled: true,
			discordUsername: null,
		});
	});
});
