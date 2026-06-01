import { describe, expect, it } from "bun:test";

import { shouldRetainTvWatchAfterDiaryLogs } from "./tv-watch-log-sync";

describe("shouldRetainTvWatchAfterDiaryLogs", () => {
	it("clears tv_watch only when no diary logs remain", () => {
		expect(shouldRetainTvWatchAfterDiaryLogs(0)).toBe(false);
		expect(shouldRetainTvWatchAfterDiaryLogs(1)).toBe(true);
		expect(shouldRetainTvWatchAfterDiaryLogs(3)).toBe(true);
	});
});
