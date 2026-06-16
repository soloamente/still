import { describe, expect, test } from "bun:test";

import {
	activeListingPresenceUserIds,
	countListingPresenceOccupants,
	getListingPresenceSnapshot,
	isListingPresenceRoom,
	LISTING_PRESENCE_MUTUAL_FETCH_LIMIT,
	LISTING_PRESENCE_STALE_MS,
	type ListingPresenceRedis,
	leaveListingPresence,
	pickListingPresenceViewingPatrons,
	presenceRedisKey,
	pruneStaleListingPresence,
	touchListingPresence,
	viewerCountExcludingSelf,
} from "./listing-presence";

/** In-memory ZSET for unit tests — mirrors Upstash score/member semantics. */
function createTestPresenceRedis() {
	const sets = new Map<string, Map<string, number>>();
	const hashes = new Map<string, Map<string, string>>();

	const redis: ListingPresenceRedis = {
		async zadd(key, { score, member }) {
			const set = sets.get(key) ?? new Map<string, number>();
			set.set(member, score);
			sets.set(key, set);
		},
		async zremrangebyscore(key, min, max) {
			const set = sets.get(key);
			if (!set) return;
			for (const [member, score] of [...set.entries()]) {
				if (score >= min && score <= max) set.delete(member);
			}
		},
		async zrem(key, member) {
			sets.get(key)?.delete(member);
		},
		async zcard(key) {
			return sets.get(key)?.size ?? 0;
		},
		async zrange(key, start, stop) {
			const set = sets.get(key);
			if (!set) return [];
			const members = [...set.entries()]
				.sort((a, b) => a[1] - b[1])
				.map(([member]) => member);
			const end = stop < 0 ? members.length + stop + 1 : stop + 1;
			return members.slice(start, end);
		},
		async expire() {},
		async hset(key, field, value) {
			const hash = hashes.get(key) ?? new Map<string, string>();
			hash.set(field, value);
			hashes.set(key, hash);
		},
		async hget(key, field) {
			return hashes.get(key)?.get(field) ?? null;
		},
		async hdel(key, field) {
			hashes.get(key)?.delete(field);
		},
	};

	return redis;
}

describe("listing-presence", () => {
	test("presenceRedisKey prefixes listing room id", () => {
		expect(presenceRedisKey("listing:movie:550")).toBe(
			"sense:presence:listing:movie:550",
		);
	});

	test("isListingPresenceRoom accepts movie and tv listing rooms only", () => {
		expect(isListingPresenceRoom("listing:movie:550")).toBe(true);
		expect(isListingPresenceRoom("listing:tv:1396")).toBe(true);
		expect(isListingPresenceRoom("review:rev_1")).toBe(false);
		expect(isListingPresenceRoom("list:lst_1")).toBe(false);
	});

	test("touch adds patron and reports changed occupancy", async () => {
		const redis = createTestPresenceRedis();
		const roomId = "listing:movie:550";

		const first = await touchListingPresence(redis, roomId, "usr_a", 1_000);
		expect(first).toEqual({ occupantCount: 1, changed: true });

		const second = await touchListingPresence(redis, roomId, "usr_b", 2_000);
		expect(second).toEqual({ occupantCount: 2, changed: true });

		const heartbeat = await touchListingPresence(redis, roomId, "usr_a", 3_000);
		expect(heartbeat).toEqual({ occupantCount: 2, changed: false });
	});

	test("leave removes patron and reports changed occupancy", async () => {
		const redis = createTestPresenceRedis();
		const roomId = "listing:tv:1396";

		await touchListingPresence(redis, roomId, "usr_a", 1_000);
		await touchListingPresence(redis, roomId, "usr_b", 2_000);

		const leave = await leaveListingPresence(redis, roomId, "usr_a", 3_000);
		expect(leave).toEqual({ occupantCount: 1, changed: true });

		const absent = await leaveListingPresence(redis, roomId, "usr_a", 4_000);
		expect(absent).toEqual({ occupantCount: 1, changed: false });
	});

	test("touch persists activity state and leave clears it", async () => {
		const redis = createTestPresenceRedis();
		const roomId = "listing:movie:7";

		await touchListingPresence(redis, roomId, "usr_a", 1_000, "away");
		expect(await redis.hget("sense:presence:activity", "usr_a")).toBe("away");

		await leaveListingPresence(redis, roomId, "usr_a", 2_000);
		expect(await redis.hget("sense:presence:activity", "usr_a")).toBeNull();
	});

	test("touch reports changed when activity flips without occupancy change", async () => {
		const redis = createTestPresenceRedis();
		const roomId = "listing:movie:99";

		await touchListingPresence(redis, roomId, "usr_a", 1_000, "active");
		const away = await touchListingPresence(
			redis,
			roomId,
			"usr_a",
			2_000,
			"away",
		);
		expect(away).toEqual({ occupantCount: 1, changed: true });

		const awayAgain = await touchListingPresence(
			redis,
			roomId,
			"usr_a",
			3_000,
			"away",
		);
		expect(awayAgain).toEqual({ occupantCount: 1, changed: false });
	});

	test("prune drops stale heartbeats before counting", async () => {
		const redis = createTestPresenceRedis();
		const roomId = "listing:movie:42";
		const now = 100_000;

		await touchListingPresence(
			redis,
			roomId,
			"usr_stale",
			now - LISTING_PRESENCE_STALE_MS - 1,
		);
		await touchListingPresence(redis, roomId, "usr_fresh", now);

		await pruneStaleListingPresence(redis, roomId, now);

		expect(await countListingPresenceOccupants(redis, roomId, now)).toBe(1);
		expect(await activeListingPresenceUserIds(redis, roomId, now)).toEqual([
			"usr_fresh",
		]);
	});

	test("viewerCountExcludingSelf subtracts caller when present", () => {
		expect(viewerCountExcludingSelf(2, "usr_a", ["usr_a", "usr_b"])).toBe(1);
		expect(viewerCountExcludingSelf(1, "usr_a", ["usr_a"])).toBe(0);
		expect(viewerCountExcludingSelf(2, "usr_x", ["usr_a", "usr_b"])).toBe(2);
	});

	test("pickListingPresenceViewingPatrons drops rows without handle and caps list", () => {
		const rows = [
			{
				userId: "usr_a",
				handle: "alice",
				displayName: "Alice",
				name: "Alice Name",
				image: "https://example.com/a.jpg",
				preferences: { avatarIsAnimated: true },
				isMutualWithViewer: true,
			},
			{
				userId: "usr_b",
				handle: null,
				displayName: "No Handle",
				name: "Bob",
				image: null,
				preferences: null,
				isMutualWithViewer: true,
			},
			{
				userId: "usr_c",
				handle: "carol",
				displayName: null,
				name: "Carol",
				image: null,
				preferences: null,
				isMutualWithViewer: true,
			},
		];
		const logCounts = new Map([
			["usr_a", 120],
			["usr_c", 50],
		]);

		const patrons = pickListingPresenceViewingPatrons(rows, logCounts, 2);

		expect(patrons).toHaveLength(2);
		expect(patrons[0]).toMatchObject({
			userId: "usr_a",
			handle: "alice",
			displayName: "Alice",
			avatarIsAnimated: true,
			diaryMetalTier: "gold",
			presenceState: "active",
		});
		expect(patrons[1]).toMatchObject({
			userId: "usr_c",
			handle: "carol",
			displayName: "Carol",
			diaryMetalTier: "silver",
			presenceState: "active",
		});
	});

	test("pickListingPresenceViewingPatrons maps activity state per user", () => {
		const rows = [
			{
				userId: "usr_a",
				handle: "alice",
				displayName: "Alice",
				name: null,
				image: null,
				preferences: null,
				isMutualWithViewer: true,
			},
		];
		const patrons = pickListingPresenceViewingPatrons(
			rows,
			new Map(),
			8,
			new Map([["usr_a", "away"]]),
		);

		expect(patrons[0]?.presenceState).toBe("away");
	});

	test("pickListingPresenceViewingPatrons default limit matches fetch cap", () => {
		const rows = Array.from({ length: 10 }, (_, index) => ({
			userId: `usr_${index}`,
			handle: `patron_${index}`,
			displayName: `Patron ${index}`,
			name: null,
			image: null,
			preferences: null,
			isMutualWithViewer: true,
		}));

		expect(pickListingPresenceViewingPatrons(rows).length).toBe(
			LISTING_PRESENCE_MUTUAL_FETCH_LIMIT,
		);
	});

	test("pickListingPresenceViewingPatrons enforces friends/public visibility", () => {
		const rows = [
			{
				userId: "usr_public",
				handle: "publicpatron",
				displayName: "Public Patron",
				name: null,
				image: null,
				preferences: { privacy: { presenceVisibility: "public" } },
				isMutualWithViewer: false,
			},
			{
				userId: "usr_friends",
				handle: "friendsonly",
				displayName: "Friends Only",
				name: null,
				image: null,
				preferences: { privacy: { presenceVisibility: "friends" } },
				isMutualWithViewer: false,
			},
			{
				userId: "usr_mutual",
				handle: "mutualfriend",
				displayName: "Mutual Friend",
				name: null,
				image: null,
				preferences: { privacy: { presenceVisibility: "friends" } },
				isMutualWithViewer: true,
			},
		];
		const patrons = pickListingPresenceViewingPatrons(rows);

		expect(patrons.map((patron) => patron.userId)).toEqual([
			"usr_public",
			"usr_mutual",
		]);
	});

	test("getListingPresenceSnapshot returns empty when redis unavailable", async () => {
		const snapshot = await getListingPresenceSnapshot(
			"usr_viewer",
			"listing:movie:550",
			null,
		);
		expect(snapshot).toEqual({ viewerCount: 0, viewingPatrons: [] });
	});

	test("getListingPresenceSnapshot excludes viewer from count with redis only", async () => {
		const redis = createTestPresenceRedis();
		const roomId = "listing:movie:99";
		const now = 50_000;

		await touchListingPresence(redis, roomId, "usr_viewer", now);
		await touchListingPresence(redis, roomId, "usr_friend", now + 1);

		const snapshot = await getListingPresenceSnapshot(
			"usr_viewer",
			roomId,
			redis,
			now + 2,
		);

		// viewerCount excludes self; viewingPatrons may be empty without DB in unit tests.
		expect(snapshot.viewerCount).toBe(1);
		expect(Array.isArray(snapshot.viewingPatrons)).toBe(true);
	});
});
