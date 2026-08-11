import { describe, expect, it } from "bun:test";

import {
	pickLatestFollowingRatingsPerPatron,
	pickResolvedFollowingRatingsForTv,
} from "./movie-following-ratings";

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

describe("pickResolvedFollowingRatingsForTv", () => {
	it("resolves season means and keeps liked from any favorite log", () => {
		const entries = pickResolvedFollowingRatingsForTv(
			[
				{
					log: {
						userId: "u1",
						rating: 60,
						liked: false,
						watchedAt: new Date("2026-01-01"),
						logScope: "season",
						seasonNumber: 1,
					},
					user: { id: "u1", name: "Mara", image: null },
					profile: { handle: "mara", displayName: "Mara" },
				},
				{
					log: {
						userId: "u1",
						rating: 80,
						liked: false,
						watchedAt: new Date("2026-01-10"),
						logScope: "season",
						seasonNumber: 2,
					},
					user: { id: "u1", name: "Mara", image: null },
					profile: { handle: "mara", displayName: "Mara" },
				},
				{
					log: {
						userId: "u1",
						rating: null,
						liked: true,
						watchedAt: new Date("2026-02-01"),
						logScope: "show",
						seasonNumber: null,
					},
					user: { id: "u1", name: "Mara", image: null },
					profile: { handle: "mara", displayName: "Mara" },
				},
			],
			"viewer",
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.rating).toBe(70);
		expect(entries[0]?.liked).toBe(true);
		expect(entries[0]?.watchedAt).toBe(new Date("2026-02-01").toISOString());
	});

	it("lets a show-scoped rating win over seasons", () => {
		const entries = pickResolvedFollowingRatingsForTv(
			[
				{
					log: {
						userId: "u1",
						rating: 90,
						liked: false,
						watchedAt: new Date("2026-01-01"),
						logScope: "show",
						seasonNumber: null,
					},
					user: { id: "u1", name: "Mara", image: null },
					profile: { handle: "mara", displayName: "Mara" },
				},
				{
					log: {
						userId: "u1",
						rating: 50,
						liked: false,
						watchedAt: new Date("2026-01-15"),
						logScope: "season",
						seasonNumber: 1,
					},
					user: { id: "u1", name: "Mara", image: null },
					profile: { handle: "mara", displayName: "Mara" },
				},
			],
			"viewer",
		);

		expect(entries[0]?.rating).toBe(90);
	});
});
