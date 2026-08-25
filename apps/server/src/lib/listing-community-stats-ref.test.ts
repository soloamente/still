import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { listingCommunityStatsRefFromLog } from "./listing-community-stats-ref";

const logsRouteSource = readFileSync(
	join(import.meta.dir, "../routes/logs.ts"),
	"utf8",
);

describe("listingCommunityStatsRefFromLog", () => {
	test("prefers the movie id when both columns could exist", () => {
		expect(
			listingCommunityStatsRefFromLog({ movieId: 550, tvId: null }),
		).toEqual({ movieId: 550 });
	});

	test("returns a tv ref for show logs", () => {
		expect(
			listingCommunityStatsRefFromLog({ movieId: null, tvId: 1399 }),
		).toEqual({ tvId: 1399 });
	});

	test("returns null when the log has no listing", () => {
		expect(
			listingCommunityStatsRefFromLog({ movieId: null, tvId: null }),
		).toBeNull();
	});
});

describe("PATCH /api/logs/:id community cache", () => {
	test("busts listing community stats after a rating edit", () => {
		const patchStart = logsRouteSource.indexOf(".patch(");
		const deleteStart = logsRouteSource.indexOf(".delete(", patchStart + 1);
		expect(patchStart).toBeGreaterThan(-1);
		expect(deleteStart).toBeGreaterThan(patchStart);
		const patchHandler = logsRouteSource.slice(patchStart, deleteStart);
		// Create/delete already bust Redis; a rating edit must too or movie
		// detail keeps the previous community average for the 5-minute TTL.
		expect(patchHandler).toContain("invalidateCommunityStatsForDiaryLog");
	});
});
