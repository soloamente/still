import { describe, expect, test } from "bun:test";

import { resolveCompanionAutoLogReport } from "./companion-autolog-status";

const USER_ID = "usr_test";
const NOW = Date.parse("2026-09-30T00:00:00.000Z");

const baseView = {
	title: "Stranger Things",
	provider: "netflix" as const,
	kind: "tv" as const,
	tmdbId: 66732,
	href: "/tv/66732",
	season: 4,
	episode: 1,
	positionSec: 100,
	durationSec: 3600,
	paused: false,
	updatedAt: new Date(NOW).toISOString(),
};

const baseMedia = {
	provider: "netflix" as const,
	kind: "episode" as const,
	title: "Stranger Things",
	season: 4,
	episode: 1,
	positionSec: 100,
	durationSec: 3600,
};

describe("resolveCompanionAutoLogReport", () => {
	test("clear heartbeats omit autoLog", () => {
		expect(
			resolveCompanionAutoLogReport({
				body: { clear: true },
				view: baseView,
				logged: null,
				recordAttempted: false,
				userId: USER_ID,
				now: NOW,
			}),
		).toBeNull();
	});

	test("early unmatched when TMDb id is missing", () => {
		expect(
			resolveCompanionAutoLogReport({
				body: { media: baseMedia },
				view: { ...baseView, tmdbId: null, href: null },
				logged: null,
				recordAttempted: false,
				userId: USER_ID,
				now: NOW,
			}),
		).toEqual({
			status: "unmatched",
			reason: "no_match",
			timing: "early",
		});
	});

	test("late unmatched at the auto-log gate", () => {
		expect(
			resolveCompanionAutoLogReport({
				body: {
					media: {
						...baseMedia,
						positionSec: 3300,
					},
				},
				view: {
					...baseView,
					tmdbId: null,
					href: null,
					positionSec: 3300,
				},
				logged: null,
				recordAttempted: false,
				userId: USER_ID,
				now: NOW,
			}),
		).toEqual({
			status: "unmatched",
			reason: "no_match",
			timing: "late",
		});
	});

	test("episode identity missing is unmatched", () => {
		expect(
			resolveCompanionAutoLogReport({
				body: {
					media: {
						...baseMedia,
						season: null,
						episode: null,
					},
				},
				view: {
					...baseView,
					season: null,
					episode: null,
				},
				logged: null,
				recordAttempted: false,
				userId: USER_ID,
				now: NOW,
			}),
		).toEqual({
			status: "unmatched",
			reason: "no_episode",
			timing: "early",
		});
	});

	test("successful log reports logged", () => {
		expect(
			resolveCompanionAutoLogReport({
				body: { media: baseMedia },
				view: baseView,
				logged: {
					logId: "log_1",
					title: "Stranger Things",
					kind: "tv",
					season: 4,
					episode: 1,
					seriesFinale: false,
				},
				recordAttempted: true,
				userId: USER_ID,
				now: NOW,
			}),
		).toEqual({ status: "logged" });
	});

	test("matched ready playback that did not write is failed", () => {
		expect(
			resolveCompanionAutoLogReport({
				body: {
					media: { ...baseMedia, positionSec: 3300 },
				},
				view: { ...baseView, positionSec: 3300 },
				logged: null,
				recordAttempted: true,
				userId: USER_ID,
				now: NOW,
			}),
		).toEqual({
			status: "failed",
			reason: "write",
			timing: "late",
		});
	});
});
