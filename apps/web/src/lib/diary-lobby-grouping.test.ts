import { describe, expect, test } from "bun:test";

import type { DiaryLogRow } from "@/components/diary/diary-entry";
import {
	buildDiaryLobbyGridItems,
	pickPrimaryTvScopeLabel,
} from "./diary-lobby-grouping";

function tvRow(
	id: string,
	tmdbId: number,
	title: string,
	watchedAt: string,
	scope: "show" | "season" | "episode",
	seasonNumber?: number,
	episodeNumber?: number,
): DiaryLogRow {
	return {
		log: {
			id,
			watchedAt,
			rating: null,
			liked: false,
			rewatch: false,
			note: null,
			logScope: scope,
			seasonNumber: seasonNumber ?? null,
			episodeNumber: episodeNumber ?? null,
		},
		movie: null,
		tv: {
			tmdbId,
			title,
			posterPath: "/bb.jpg",
			year: 2008,
		},
	};
}

describe("pickPrimaryTvScopeLabel", () => {
	test("prefers episode over season and whole show", () => {
		const logs = [
			tvRow("1", 1396, "Breaking Bad", "2024-01-01", "show"),
			tvRow("2", 1396, "Breaking Bad", "2024-06-01", "season", 1),
			tvRow("3", 1396, "Breaking Bad", "2024-12-01", "episode", 1, 3),
		];
		expect(pickPrimaryTvScopeLabel(logs)).toBe("S01E03");
	});
});

describe("buildDiaryLobbyGridItems", () => {
	test("groups TV logs by tmdb id and keeps films separate", () => {
		const rows = [
			tvRow("a", 1396, "Breaking Bad", "2024-01-01", "season", 1),
			tvRow("b", 1396, "Breaking Bad", "2024-02-01", "show"),
			{
				log: {
					id: "c",
					watchedAt: "2024-03-01",
					rating: 8,
					liked: false,
					rewatch: false,
					note: null,
				},
				movie: {
					tmdbId: 550,
					title: "Fight Club",
					posterPath: null,
					year: 1999,
				},
				tv: null,
			},
		];
		const items = buildDiaryLobbyGridItems(rows, "latest_seen");
		expect(items.filter((i) => i.kind === "tvGroup")).toHaveLength(1);
		expect(items.filter((i) => i.kind === "movie")).toHaveLength(1);
		const group = items.find((i) => i.kind === "tvGroup");
		if (group?.kind === "tvGroup") {
			expect(group.logs).toHaveLength(2);
			expect(group.key).toBe("tv-1396");
		}
	});
});
