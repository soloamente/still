import { describe, expect, it } from "bun:test";

import { pickLatestFollowingRatingsPerPatron } from "./movie-following-ratings";

describe("pickLatestFollowingRatingsPerPatron", () => {
	it("keeps the newest log per patron and drops the viewer", () => {
		const older = new Date("2024-01-01");
		const newer = new Date("2024-06-01");

		const entries = pickLatestFollowingRatingsPerPatron(
			[
				{
					log: {
						userId: "u1",
						rating: 85,
						liked: false,
						watchedAt: older,
					},
					user: { id: "u1", name: "Mara", image: null },
					profile: { handle: "mara", displayName: "Mara" },
				},
				{
					log: {
						userId: "u1",
						rating: 90,
						liked: false,
						watchedAt: newer,
					},
					user: { id: "u1", name: "Mara", image: null },
					profile: { handle: "mara", displayName: "Mara" },
				},
				{
					log: {
						userId: "viewer",
						rating: 100,
						liked: false,
						watchedAt: newer,
					},
					user: { id: "viewer", name: "Me", image: null },
					profile: { handle: "me", displayName: "Me" },
				},
			],
			"viewer",
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.handle).toBe("mara");
		expect(entries[0]?.rating).toBe(90);
	});

	it("skips rows without a public handle", () => {
		const entries = pickLatestFollowingRatingsPerPatron(
			[
				{
					log: {
						userId: "u2",
						rating: 50,
						liked: false,
						watchedAt: new Date(),
					},
					user: { id: "u2", name: "Ghost", image: null },
					profile: null,
				},
			],
			"viewer",
		);

		expect(entries).toHaveLength(0);
	});
});
