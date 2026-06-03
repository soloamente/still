import { describe, expect, test } from "bun:test";
import type { LeaderboardLogItem } from "@/lib/home-leaderboard-types";
import { patronWatchLedgerPosterLabels } from "@/lib/patron-watch-ledger-poster-labels";

function item(
	overrides: Partial<LeaderboardLogItem> & Pick<LeaderboardLogItem, "logId">,
): LeaderboardLogItem {
	return {
		watchedAt: "2026-01-15T12:00:00.000Z",
		movieId: 1,
		tvId: null,
		title: "Test Film",
		posterPath: null,
		rating: null,
		rewatch: false,
		watchIndexInPeriod: 1,
		watchCountInPeriod: 1,
		...overrides,
	};
}

describe("patronWatchLedgerPosterLabels", () => {
	test("marks a lone rewatch log", () => {
		const labels = patronWatchLedgerPosterLabels(
			item({ logId: "a", rewatch: true }),
		);
		expect(labels.posterCaption).toBe("Rewatch");
		expect(labels.metaLine).toContain("Rewatch");
	});

	test("shows ordinal when the same title was logged multiple times", () => {
		const labels = patronWatchLedgerPosterLabels(
			item({
				logId: "b",
				rewatch: true,
				watchIndexInPeriod: 2,
				watchCountInPeriod: 3,
			}),
		);
		expect(labels.posterCaptionSubline).toContain("2nd watch");
		expect(labels.posterCaptionSubline).toContain("3× in period");
	});
});
