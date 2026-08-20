import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { DiscordActivityDisplay } from "./discord-activity";
import { computePatronEntitlements } from "./patron-entitlements";

const OWNER_ID = "usr_owner";
const VIEWER_ID = "usr_viewer";
const DISCORD_ID = "94490510688792576";

const sampleActivity: DiscordActivityDisplay = {
	kind: "listening",
	label: "Listening to Let Go",
	headline: "Let Go",
	source: "Spotify",
	detail: "Ark Patrol",
	imageUrl: null,
	progress: undefined,
	accentColor: null,
};

const fetchProfileAccessByHandleMock = mock(
	async (
		handle: string,
	): Promise<{ userId: string; isPrivate: boolean } | null> => {
		if (handle === "missing") return null;
		if (handle === "private") return { userId: OWNER_ID, isPrivate: true };
		return { userId: OWNER_ID, isPrivate: false };
	},
);

const fetchMutualFollowingIdsMock = mock(
	async (_viewerId: string) => [] as string[],
);

const getCachedLanyardPresenceMock = mock(async (_discordId: string) => ({
	listening_to_spotify: true,
	spotify: {
		song: "Let Go",
		artist: "Ark Patrol",
		album_art_url: null,
	},
	activities: [],
	discord_status: "online",
}));

const isDiscordActivityEnabledMock = mock(() => true);

const fetchDiscordActivityProfileMetadataMock = mock(
	async (_userId: string) => ({
		userId: OWNER_ID,
		isPrivate: false,
		preferences: {} as Record<string, unknown>,
		discordAccountId: DISCORD_ID,
	}),
);

mock.module("./discord-activity-config", () => ({
	isDiscordActivityEnabled: isDiscordActivityEnabledMock,
}));

mock.module("./discord-activity-metadata-cache", () => ({
	fetchProfileAccessByHandle: fetchProfileAccessByHandleMock,
	fetchDiscordActivityProfileMetadata: fetchDiscordActivityProfileMetadataMock,
	invalidateDiscordActivityMetadata: mock(async () => {}),
}));

mock.module("./mutual-follow-cache", () => ({
	fetchMutualFollowingIds: fetchMutualFollowingIdsMock,
}));

mock.module("./lanyard-client", () => ({
	getCachedLanyardPresence: getCachedLanyardPresenceMock,
}));

mock.module("./discord-activity-cover-palette", () => ({
	resolveDiscordActivityCoverAccent: mock(async () => null),
}));

const entitlementByOwner = new Map<
	string,
	{ subscriptionTier: "still" | "attuned"; planOverride?: "attuned" | null }
>();

mock.module("./patron-entitlements", () => ({
	loadPatronEntitlements: async (userId: string) => {
		const row = entitlementByOwner.get(userId) ?? {
			subscriptionTier: "attuned" as const,
			planOverride: null,
		};
		return computePatronEntitlements({
			subscriptionTier: row.subscriptionTier,
			planOverride: row.planOverride ?? null,
			featureGrantKeys: [],
		});
	},
}));

describe("fetchProfileDiscordActivity", () => {
	let fetchProfileDiscordActivity: typeof import("./fetch-profile-discord-activity").fetchProfileDiscordActivity;

	beforeEach(async () => {
		isDiscordActivityEnabledMock.mockClear();
		fetchProfileAccessByHandleMock.mockClear();
		fetchMutualFollowingIdsMock.mockClear();
		getCachedLanyardPresenceMock.mockClear();
		fetchDiscordActivityProfileMetadataMock.mockClear();
		entitlementByOwner.clear();
		entitlementByOwner.set(OWNER_ID, {
			subscriptionTier: "attuned",
			planOverride: null,
		});

		isDiscordActivityEnabledMock.mockReturnValue(true);
		fetchMutualFollowingIdsMock.mockImplementation(async () => []);
		fetchDiscordActivityProfileMetadataMock.mockImplementation(async () => ({
			userId: OWNER_ID,
			isPrivate: false,
			preferences: {},
			discordAccountId: DISCORD_ID,
		}));
		getCachedLanyardPresenceMock.mockImplementation(async () => ({
			listening_to_spotify: true,
			spotify: {
				song: "Let Go",
				artist: "Ark Patrol",
				album_art_url: null,
			},
			activities: [],
			discord_status: "online",
		}));

		const mod = await import("./fetch-profile-discord-activity");
		fetchProfileDiscordActivity = mod.fetchProfileDiscordActivity;
	});

	test("returns visible false when feature flag infrastructure is off", async () => {
		isDiscordActivityEnabledMock.mockReturnValue(false);

		const result = await fetchProfileDiscordActivity({
			handle: "owner",
			viewerId: VIEWER_ID,
		});

		expect(result).toEqual({ ok: true, body: { visible: false } });
		expect(fetchProfileAccessByHandleMock).not.toHaveBeenCalled();
	});

	test("404 when profile is not viewable", async () => {
		const result = await fetchProfileDiscordActivity({
			handle: "missing",
			viewerId: VIEWER_ID,
		});

		expect(result).toEqual({
			ok: false,
			status: 404,
			error: "Not found",
		});
	});

	test("404 for private profile when viewer is not owner", async () => {
		const result = await fetchProfileDiscordActivity({
			handle: "private",
			viewerId: VIEWER_ID,
		});

		expect(result).toEqual({
			ok: false,
			status: 404,
			error: "Not found",
		});
	});

	test("unsigned viewer always receives visible false", async () => {
		fetchDiscordActivityProfileMetadataMock.mockImplementation(async () => ({
			userId: OWNER_ID,
			isPrivate: false,
			preferences: { privacy: { presenceVisibility: "public" } },
			discordAccountId: DISCORD_ID,
		}));

		const result = await fetchProfileDiscordActivity({
			handle: "owner",
			viewerId: null,
		});

		expect(result).toEqual({ ok: true, body: { visible: false } });
		expect(getCachedLanyardPresenceMock).not.toHaveBeenCalled();
	});

	test("returns activity for mutual follower on friends-only profile", async () => {
		fetchMutualFollowingIdsMock.mockImplementation(async () => [OWNER_ID]);

		const result = await fetchProfileDiscordActivity({
			handle: "owner",
			viewerId: VIEWER_ID,
		});

		expect(result).toEqual({
			ok: true,
			body: { visible: true, activity: sampleActivity },
		});
		expect(getCachedLanyardPresenceMock).toHaveBeenCalledWith(DISCORD_ID);
	});

	test("hides activity from non-mutual viewer when friends-only", async () => {
		const result = await fetchProfileDiscordActivity({
			handle: "owner",
			viewerId: VIEWER_ID,
		});

		expect(result).toEqual({ ok: true, body: { visible: false } });
	});

	test("returns visible false when Discord is not linked", async () => {
		fetchDiscordActivityProfileMetadataMock.mockImplementation(async () => ({
			userId: OWNER_ID,
			isPrivate: false,
			preferences: {},
			discordAccountId: null,
		}));

		const result = await fetchProfileDiscordActivity({
			handle: "owner",
			viewerId: OWNER_ID,
		});

		expect(result).toEqual({ ok: true, body: { visible: false } });
		expect(getCachedLanyardPresenceMock).not.toHaveBeenCalled();
	});

	test("returns visible false when owner lacks discord_activity entitlement", async () => {
		entitlementByOwner.set(OWNER_ID, {
			subscriptionTier: "still",
			planOverride: null,
		});

		const result = await fetchProfileDiscordActivity({
			handle: "owner",
			viewerId: OWNER_ID,
		});

		expect(result).toEqual({ ok: true, body: { visible: false } });
		expect(getCachedLanyardPresenceMock).not.toHaveBeenCalled();
	});

	test("returns visible false when Lanyard has no activity", async () => {
		getCachedLanyardPresenceMock.mockImplementation(async () => null);

		const result = await fetchProfileDiscordActivity({
			handle: "owner",
			viewerId: OWNER_ID,
		});

		expect(result).toEqual({ ok: true, body: { visible: false } });
	});

	test("never includes discordId in the response body", async () => {
		const result = await fetchProfileDiscordActivity({
			handle: "owner",
			viewerId: OWNER_ID,
		});

		expect(JSON.stringify(result)).not.toContain(DISCORD_ID);
	});
});
