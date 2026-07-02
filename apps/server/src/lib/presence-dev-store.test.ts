import { describe, expect, test } from "bun:test";
import { patronAppRoomId } from "@still/realtime";

import {
	activeListingPresenceUserIds,
	touchListingPresence,
} from "./listing-presence";
import { getPresenceRedis } from "./presence-redis";

describe("presence storage", () => {
	test("records heartbeats and returns active user ids", async () => {
		const redis = getPresenceRedis();
		expect(redis).not.toBeNull();
		if (!redis) return;

		const room = patronAppRoomId();
		const now = Date.now();
		await touchListingPresence(redis, room, "usr_local", now, "away");

		const activeIds = await activeListingPresenceUserIds(redis, room, now);
		expect(activeIds).toContain("usr_local");
	});
});
