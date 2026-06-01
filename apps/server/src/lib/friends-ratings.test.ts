import { describe, expect, test } from "bun:test";

import {
	FRIENDS_RATINGS_LIMIT,
	type RawFriendLog,
	rankFriendsRatings,
} from "./friends-ratings";

function row(over: Partial<RawFriendLog> & { userId: string }): RawFriendLog {
	return {
		handle: over.userId,
		displayName: null,
		name: null,
		avatarUrl: null,
		rating: null,
		liked: false,
		watchedAt: "2026-01-01T00:00:00.000Z",
		...over,
	};
}

describe("rankFriendsRatings", () => {
	test("collapses a friend's rewatches to their highest-rated log", () => {
		const result = rankFriendsRatings([
			row({ userId: "mara", rating: 6, watchedAt: "2026-05-01T00:00:00Z" }),
			row({ userId: "mara", rating: 9, watchedAt: "2026-01-01T00:00:00Z" }),
		]);
		expect(result.total).toBe(1);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.rating).toBe(9);
	});

	test("rated friends sort before liked-only, highest rating first", () => {
		const result = rankFriendsRatings([
			row({ userId: "liked-only", rating: null, liked: true }),
			row({ userId: "mid", rating: 7 }),
			row({ userId: "top", rating: 10 }),
		]);
		expect(result.rows.map((r) => r.userId)).toEqual([
			"top",
			"mid",
			"liked-only",
		]);
	});

	test("liked-only friend keeps liked flag and null rating", () => {
		const result = rankFriendsRatings([
			row({ userId: "jules", rating: null, liked: true }),
		]);
		expect(result.rows[0]).toMatchObject({ rating: null, liked: true });
	});

	test("ties on rating break by most recent watch", () => {
		const result = rankFriendsRatings([
			row({ userId: "older", rating: 8, watchedAt: "2026-01-01T00:00:00Z" }),
			row({ userId: "newer", rating: 8, watchedAt: "2026-06-01T00:00:00Z" }),
		]);
		expect(result.rows.map((r) => r.userId)).toEqual(["newer", "older"]);
	});

	test("displayName falls back to name then handle", () => {
		const [withName, withHandle] = rankFriendsRatings([
			row({ userId: "a", rating: 9, displayName: null, name: "Real Name" }),
			row({
				userId: "b",
				rating: 8,
				displayName: null,
				name: null,
				handle: "bee",
			}),
		]).rows;
		expect(withName?.displayName).toBe("Real Name");
		expect(withHandle?.displayName).toBe("bee");
	});

	test("caps rows at the chip limit but reports the full distinct total", () => {
		const raw: RawFriendLog[] = Array.from(
			{ length: FRIENDS_RATINGS_LIMIT + 5 },
			(_, i) => row({ userId: `friend-${i}`, rating: i % 10 }),
		);
		const result = rankFriendsRatings(raw);
		expect(result.total).toBe(FRIENDS_RATINGS_LIMIT + 5);
		expect(result.rows).toHaveLength(FRIENDS_RATINGS_LIMIT);
	});

	test("empty input yields no rows", () => {
		expect(rankFriendsRatings([])).toEqual({ rows: [], total: 0 });
	});
});
