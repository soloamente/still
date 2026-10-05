import { describe, expect, test } from "bun:test";

import {
	COMPANION_AUTO_LOG_WINDOW_MS,
	companionAutoLogKey,
	companionAutoLogRecentlyRecorded,
	companionDisplayRatingToStored,
	companionPlaybackReadyToLog,
	companionRatingTarget,
	rememberCompanionAutoLog,
	resetCompanionAutoLogMemory,
} from "./companion-auto-log";

const EPISODE = {
	kind: "tv" as const,
	tmdbId: 66732,
	season: 4,
	episode: 1,
	positionSec: 3300,
	durationSec: 3600,
};

describe("companionPlaybackReadyToLog", () => {
	test("an episode in the last tenth is ready", () => {
		expect(companionPlaybackReadyToLog(EPISODE)).toBe(true);
	});

	test("the same episode earlier in the runtime waits", () => {
		expect(companionPlaybackReadyToLog({ ...EPISODE, positionSec: 12 })).toBe(
			false,
		);
	});

	test("just short of the threshold waits", () => {
		expect(companionPlaybackReadyToLog({ ...EPISODE, positionSec: 3239 })).toBe(
			false,
		);
	});

	test("a clip under ten minutes never logs", () => {
		expect(
			companionPlaybackReadyToLog({
				...EPISODE,
				positionSec: 500,
				durationSec: 540,
			}),
		).toBe(false);
	});

	test("a movie does not need a season or episode", () => {
		expect(
			companionPlaybackReadyToLog({
				kind: "movie",
				tmdbId: 641934,
				season: null,
				episode: null,
				positionSec: 4700,
				durationSec: 5192,
			}),
		).toBe(true);
	});

	test("an episode without a number waits", () => {
		expect(
			companionPlaybackReadyToLog({ ...EPISODE, season: null, episode: null }),
		).toBe(false);
	});

	test("a missing TMDb match waits", () => {
		expect(companionPlaybackReadyToLog({ ...EPISODE, tmdbId: null })).toBe(
			false,
		);
	});

	test("a position far past the runtime is ignored", () => {
		expect(
			companionPlaybackReadyToLog({ ...EPISODE, positionSec: 99_999 }),
		).toBe(false);
	});
});

describe("companion auto log memory", () => {
	test("the same episode is skipped until the window passes", () => {
		resetCompanionAutoLogMemory();
		const key = companionAutoLogKey("usr_1", EPISODE);
		expect(key).toBe("usr_1:tv:66732:4:1");
		if (!key) return;
		rememberCompanionAutoLog(key, 1_000);
		expect(companionAutoLogRecentlyRecorded(key, 1_000 + 60_000)).toBe(true);
		expect(
			companionAutoLogRecentlyRecorded(
				key,
				1_000 + COMPANION_AUTO_LOG_WINDOW_MS,
			),
		).toBe(false);
	});

	test("a rating on the 0 to 10 scale becomes tenths", () => {
		expect(companionDisplayRatingToStored(7.4)).toBe(74);
		expect(companionDisplayRatingToStored(10)).toBe(100);
		expect(companionDisplayRatingToStored(10.4)).toBeNull();
	});

	test("an episode rewatch updates the earlier score", () => {
		expect(
			companionRatingTarget({
				kind: "tv",
				logId: "log_new",
				earlierLogId: "log_old",
			}),
		).toBe("log_old");
		expect(
			companionRatingTarget({
				kind: "movie",
				logId: "log_new",
				earlierLogId: "log_old",
			}),
		).toBe("log_new");
	});

	test("a film key ignores season and episode", () => {
		expect(
			companionAutoLogKey("usr_1", {
				kind: "movie",
				tmdbId: 641934,
				season: 1,
				episode: 2,
			}),
		).toBe("usr_1:movie:641934");
	});
});
