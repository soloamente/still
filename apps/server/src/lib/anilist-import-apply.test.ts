import { describe, expect, test } from "bun:test";

import {
	anilistStatusToTvWatchStatus,
	applyAnilistImport,
} from "./anilist-import-apply";
import type { AnilistImportEntry } from "./anilist-import-json";

describe("anilistStatusToTvWatchStatus", () => {
	test("maps list statuses to tv_watch lifecycle", () => {
		expect(anilistStatusToTvWatchStatus("COMPLETED")).toBe("finished");
		expect(anilistStatusToTvWatchStatus("CURRENT")).toBe("watching");
		expect(anilistStatusToTvWatchStatus("REPEATING")).toBe("rewatching");
		expect(anilistStatusToTvWatchStatus("PAUSED")).toBe("paused");
		expect(anilistStatusToTvWatchStatus("DROPPED")).toBe("abandoned");
		expect(anilistStatusToTvWatchStatus("PLANNING")).toBeNull();
	});
});

describe("applyAnilistImport", () => {
	test("counts rows as unmatched when TMDb TV cache fails", async () => {
		const entry: AnilistImportEntry = {
			media: {
				anilistId: 1535,
				title: { english: "Death Note" },
			},
			status: "COMPLETED",
			score: 90,
			completedAt: "2024-01-01T00:00:00.000Z",
		};

		const result = await applyAnilistImport({
			userId: "user_test",
			entries: [entry],
			language: "en-US",
			resolveTvId: async () => 1399,
			ensureTv: async () => false,
		});

		expect(result.unmatched).toBe(1);
		expect(result.imported).toBe(0);
		expect(result.unmatchedTitles[0]?.title).toBe("Death Note");
	});
});
