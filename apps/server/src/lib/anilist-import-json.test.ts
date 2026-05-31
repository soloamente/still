import { describe, expect, test } from "bun:test";

import {
	anilistImportDedupeKey,
	anilistScoreToStoredTenths,
	dedupeAnilistEntries,
	normalizeAnilistListEntry,
	normalizeAniPortBackup,
	parseAnilistImportJson,
} from "./anilist-import-json";

describe("anilistScoreToStoredTenths", () => {
	test("maps 0–100 Anilist scores to stored tenths", () => {
		expect(anilistScoreToStoredTenths(85)).toBe(85);
		expect(anilistScoreToStoredTenths(100)).toBe(100);
		expect(anilistScoreToStoredTenths(150)).toBe(100);
	});
});

describe("normalizeAnilistListEntry", () => {
	test("maps GraphQL-shaped entry", () => {
		const entry = normalizeAnilistListEntry({
			status: "COMPLETED",
			score: 90,
			progress: 24,
			media: {
				id: 1535,
				idMal: 1535,
				type: "ANIME",
				title: {
					userPreferred: "Death Note",
					romaji: "DEATH NOTE",
				},
				startDate: { year: 2006 },
			},
			completedAt: "2024-01-15T00:00:00Z",
		});
		expect(entry?.media.anilistId).toBe(1535);
		expect(entry?.media.title.userPreferred).toBe("Death Note");
		expect(entry?.status).toBe("COMPLETED");
		expect(entry?.score).toBe(90);
		expect(entry?.progress).toBe(24);
	});

	test("reads flat mediaId + string title rows", () => {
		const entry = normalizeAnilistListEntry({
			status: "CURRENT",
			progress: 5,
			mediaId: 21,
			title: "One Piece",
		});
		expect(entry?.media.anilistId).toBe(21);
		expect(entry?.media.title.english).toBe("One Piece");
		expect(entry?.status).toBe("CURRENT");
	});

	test("parses string title on media object", () => {
		const entry = normalizeAnilistListEntry({
			status: "PLANNING",
			media: {
				id: 99,
				type: "ANIME",
				title: "Naruto",
			},
		});
		expect(entry?.media.title.userPreferred).toBe("Naruto");
	});

	test("skips manga entries", () => {
		expect(
			normalizeAnilistListEntry({
				status: "COMPLETED",
				media: { id: 1, type: "MANGA", title: { romaji: "Berserk" } },
			}),
		).toBeNull();
	});
});

describe("parseAnilistImportJson", () => {
	test("parses canonical file", () => {
		const json = JSON.stringify({
			version: 1,
			source: "anilist",
			entries: [
				{
					media: {
						anilistId: 1,
						title: { english: "Show A" },
					},
					status: "PLANNING",
				},
			],
		});
		const rows = parseAnilistImportJson(json);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.status).toBe("PLANNING");
	});

	test("parses GraphQL MediaListCollection export", () => {
		const json = JSON.stringify({
			data: {
				MediaListCollection: {
					lists: [
						{
							entries: [
								{
									status: "CURRENT",
									progress: 3,
									media: {
										id: 99,
										type: "ANIME",
										title: { romaji: "Naruto" },
									},
								},
							],
						},
					],
				},
			},
		});
		const rows = parseAnilistImportJson(json);
		expect(rows[0]?.media.anilistId).toBe(99);
		expect(rows[0]?.progress).toBe(3);
	});

	test("dedupe key is stable", () => {
		const entry = normalizeAnilistListEntry({
			status: "COMPLETED",
			media: { id: 5, type: "ANIME", title: { english: "X" } },
			completedAt: "2024-06-01T12:00:00Z",
		});
		expect(entry).not.toBeNull();
		if (!entry) return;
		expect(anilistImportDedupeKey(entry)).toBe(
			"anilist:5:COMPLETED:2024-06-01",
		);
	});

	test("reads snake_case started_at / completed_at timestamps", () => {
		const entry = normalizeAnilistListEntry({
			status: "CURRENT",
			mediaId: 77,
			title: "Steins;Gate",
			started_at: "2023-05-01T00:00:00Z",
			progress: 12,
		});
		expect(entry?.startedAt).toBe("2023-05-01T00:00:00Z");
		expect(entry?.status).toBe("CURRENT");
	});
});

describe("normalizeAniPortBackup", () => {
	test("reads top-level anime array", () => {
		const rows = normalizeAniPortBackup({
			anime: [
				{
					status: "DROPPED",
					media: { id: 42, type: "ANIME", title: { english: "Dropped Show" } },
				},
			],
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]?.status).toBe("DROPPED");
	});
});

describe("dedupeAnilistEntries", () => {
	test("keeps last row per anilist id", () => {
		const merged = dedupeAnilistEntries([
			{
				media: {
					anilistId: 1,
					title: { english: "A" },
				},
				status: "PLANNING",
			},
			{
				media: {
					anilistId: 1,
					title: { english: "A" },
				},
				status: "COMPLETED",
				score: 80,
			},
		]);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.status).toBe("COMPLETED");
	});
});
