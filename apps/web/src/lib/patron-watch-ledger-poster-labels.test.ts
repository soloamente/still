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
		watchIndexLifetime: 1,
		watchCountLifetime: 1,
		...overrides,
	};
}

describe("patronWatchLedgerPosterLabels", () => {
	test("marks a lone rewatch log", () => {
		const labels = patronWatchLedgerPosterLabels(
			item({ logId: "a", rewatch: true, watchIndexLifetime: 2 }),
		);
		expect(labels.posterCaption).toBe("2nd watch");
		expect(labels.posterCaptionSubline).toBeNull();
		expect(labels.metaLine).not.toContain("2nd watch");
	});

	test("uses lifetime ordinal with period order — not a bare repeat count", () => {
		const labels = patronWatchLedgerPosterLabels(
			item({
				logId: "b",
				rewatch: true,
				watchIndexInPeriod: 2,
				watchCountInPeriod: 2,
				watchIndexLifetime: 4,
				watchCountLifetime: 4,
				rating: 96,
			}),
		);
		expect(labels.posterCaption).toBe("9.6");
		expect(labels.posterCaptionSubline).toBe("4th watch · 2nd this month");
		expect(labels.posterCaptionSubline).not.toContain("in this period");
	});

	test("uses week phrasing when the rank window is weekly", () => {
		const labels = patronWatchLedgerPosterLabels(
			item({
				logId: "e",
				rating: 70,
				watchIndexInPeriod: 1,
				watchCountInPeriod: 2,
				watchIndexLifetime: 3,
			}),
			"week",
		);
		expect(labels.posterCaptionSubline).toBe("3rd watch · 1st this week");
	});

	test("marks first log in a multi-watch period", () => {
		const labels = patronWatchLedgerPosterLabels(
			item({
				logId: "d",
				rating: 80,
				watchIndexInPeriod: 1,
				watchCountInPeriod: 3,
				watchIndexLifetime: 2,
			}),
			"month",
		);
		expect(labels.posterCaptionSubline).toBe("2nd watch · 1st this month");
	});

	test("keeps rating on poster caption only — not in meta line", () => {
		const labels = patronWatchLedgerPosterLabels(
			item({
				logId: "c",
				rating: 96,
				rewatch: true,
				watchIndexLifetime: 2,
			}),
		);
		expect(labels.posterCaption).toBe("9.6");
		expect(labels.posterCaptionSubline).toBe("2nd watch");
		expect(labels.metaLine).not.toContain("9.6");
		expect(labels.metaLine).not.toContain("2nd watch");
	});
});
