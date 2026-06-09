import { describe, expect, test } from "bun:test";

import { assembleExportFiles, type ExportInput } from "./me-export-data";

const baseInput: ExportInput = {
	profile: {
		handle: "adgv",
		displayName: "Anselmo",
		bio: "cinema",
		pronouns: null,
		location: null,
		website: null,
		joinedAt: new Date("2026-01-06T10:00:00Z"),
		email: "adgv@example.com",
	},
	favoriteFilms: [{ title: "Whiplash", year: 2014, tmdbId: 244786 }],
	filmLogs: [
		{
			title: "Whiplash",
			year: 2014,
			tmdbId: 244786,
			watchedAt: new Date("2026-01-06T00:00:00Z"),
			createdAt: new Date("2026-01-06T12:00:00Z"),
			rating: 95,
			rewatch: true,
			liked: true,
			note: null,
		},
	],
	tvLogs: [
		{
			title: "Severance",
			year: 2022,
			tmdbId: 95396,
			watchedAt: new Date("2026-02-01T00:00:00Z"),
			createdAt: new Date("2026-02-01T12:00:00Z"),
			rating: 88,
			rewatch: false,
			liked: false,
			note: "great finale",
			logScope: "season",
			seasonNumber: 2,
			episodeNumber: null,
		},
	],
	filmWatchlist: [
		{
			title: "One Battle After Another",
			year: 2025,
			tmdbId: 1084736,
			addedAt: new Date("2026-01-06T09:00:00Z"),
		},
	],
	tvWatchlist: [
		{
			title: "The Pitt",
			year: 2025,
			tmdbId: 250307,
			addedAt: new Date("2026-03-01T09:00:00Z"),
		},
	],
	tvProgress: [
		{
			title: "Severance",
			year: 2022,
			tmdbId: 95396,
			status: "finished",
			lastSeason: 2,
			lastEpisode: 10,
			startedAt: new Date("2026-01-10T00:00:00Z"),
			statusChangedAt: new Date("2026-02-01T00:00:00Z"),
		},
	],
	reviews: [
		{
			title: "Whiplash",
			year: 2014,
			tmdbId: 244786,
			reviewTitle: "Tempo",
			body: "Not quite my tempo, indeed.",
			rating: 95,
			containsSpoilers: false,
			publishedAt: new Date("2026-01-07T00:00:00Z"),
			watchedAt: new Date("2026-01-06T00:00:00Z"),
		},
	],
	lists: [
		{
			title: "Favorites",
			description: null,
			isRanked: true,
			items: [
				{
					position: 0,
					title: "Whiplash",
					year: 2014,
					tmdbId: 244786,
					mediaType: "film",
					note: null,
					addedAt: new Date("2026-01-06T12:00:00Z"),
				},
			],
		},
	],
	comments: [
		{
			parentType: "review",
			parentId: "rev_1",
			body: "agreed!",
			createdAt: new Date("2026-01-08T00:00:00Z"),
		},
	],
	likedReviews: [
		{
			reviewId: "rev_2",
			movieTitle: "Sound of Metal",
			likedAt: new Date("2026-01-09T00:00:00Z"),
		},
	],
	likedLists: [
		{
			listId: "list_2",
			listTitle: "Best of 2024",
			likedAt: new Date("2026-01-10T00:00:00Z"),
		},
	],
};

describe("assembleExportFiles", () => {
	test("emits the full Letterboxd-style file set", () => {
		const files = assembleExportFiles(baseInput);
		const paths = files.map((f) => f.path).sort();
		expect(paths).toEqual(
			[
				"comments.csv",
				"diary.csv",
				"likes/films.csv",
				"likes/lists.csv",
				"likes/reviews.csv",
				"lists/favorites.csv",
				"profile.csv",
				"ratings.csv",
				"reviews.csv",
				"tv-diary.csv",
				"tv-progress.csv",
				"tv-watchlist.csv",
				"watched.csv",
				"watchlist.csv",
			].sort(),
		);
	});

	test("diary.csv uses the Letterboxd column layout and star scale", () => {
		const diary = assembleExportFiles(baseInput).find(
			(f) => f.path === "diary.csv",
		);
		expect(diary?.contents).toBe(
			"Date,Name,Year,TMDb ID,Rating,Rating10,Rewatch,Watched Date\n" +
				"2026-01-06,Whiplash,2014,244786,5,9.5,Yes,2026-01-06\n",
		);
	});

	test("ratings.csv keeps one row per film with the latest rating", () => {
		const input: ExportInput = {
			...baseInput,
			filmLogs: [
				...baseInput.filmLogs,
				{
					title: "Whiplash",
					year: 2014,
					tmdbId: 244786,
					watchedAt: new Date("2026-03-01T00:00:00Z"),
					createdAt: new Date("2026-03-01T12:00:00Z"),
					rating: 80,
					rewatch: true,
					liked: true,
					note: null,
				},
			],
		};
		const ratings = assembleExportFiles(input).find(
			(f) => f.path === "ratings.csv",
		);
		const lines = ratings?.contents.trim().split("\n") ?? [];
		expect(lines).toHaveLength(2); // header + one film
		expect(lines[1]).toContain("4"); // 80 tenths → 8.0 display → 4 stars
		expect(lines[1]).toContain("8.0");
	});

	test("tv-diary.csv carries scope and season columns", () => {
		const tvDiary = assembleExportFiles(baseInput).find(
			(f) => f.path === "tv-diary.csv",
		);
		expect(tvDiary?.contents).toContain(
			"Date,Name,Year,TMDb ID,Scope,Season,Episode,Rating,Rating10,Rewatch,Watched Date",
		);
		expect(tvDiary?.contents).toContain("season,2,");
	});

	test("watchlist.csv contains films only", () => {
		const watchlist = assembleExportFiles(baseInput).find(
			(f) => f.path === "watchlist.csv",
		);
		expect(watchlist?.contents).toContain("One Battle After Another");
		expect(watchlist?.contents).not.toContain("The Pitt");
	});

	test("list slugs dedupe on collision", () => {
		const input: ExportInput = {
			...baseInput,
			lists: [
				{ title: "Best!", description: null, isRanked: false, items: [] },
				{ title: "Best?", description: null, isRanked: false, items: [] },
			],
		};
		const paths = assembleExportFiles(input)
			.map((f) => f.path)
			.filter((p) => p.startsWith("lists/"));
		expect(paths).toEqual(["lists/best.csv", "lists/best-2.csv"]);
	});

	test("unrated logs leave rating columns empty", () => {
		const input: ExportInput = {
			...baseInput,
			filmLogs: baseInput.filmLogs.map((row) => ({ ...row, rating: null })),
		};
		const diary = assembleExportFiles(input).find(
			(f) => f.path === "diary.csv",
		);
		expect(diary?.contents).toContain("244786,,,Yes");
		const ratings = assembleExportFiles(input).find(
			(f) => f.path === "ratings.csv",
		);
		expect(ratings?.contents.trim().split("\n")).toHaveLength(1); // header only
	});
});
