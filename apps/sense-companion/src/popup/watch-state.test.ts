import { describe, expect, test } from "bun:test";

import type { CompanionActivityMessage } from "../presence/activity-log";
import {
	formatPopupWatchDetail,
	type PopupWatch,
	popupWatchFromMessage,
	readPopupWatch,
} from "./watch-state";

function requireWatch(watch: PopupWatch | null): PopupWatch {
	if (!watch) throw new Error("expected a watch");
	return watch;
}

function activity(
	overrides: Partial<
		Extract<CompanionActivityMessage, { type: "sense-companion:activity" }>
	>,
): CompanionActivityMessage {
	return {
		type: "sense-companion:activity",
		service: "Netflix",
		activity: {
			details: null,
			state: null,
			largeImageKey: null,
			largeImageText: null,
			smallImageKey: null,
			smallImageText: null,
			startTimestamp: null,
			endTimestamp: null,
			name: "Stranger Things",
			type: 3,
		},
		senseMedia: {
			provider: "netflix",
			kind: "episode",
			title: "Stranger Things",
			season: 4,
			episode: 1,
			positionSec: 30,
			durationSec: 3600,
		},
		...overrides,
	};
}

describe("popupWatchFromMessage", () => {
	test("an episode keeps the show title and S4 E1", () => {
		const watch = popupWatchFromMessage(activity({}));
		expect(watch).toEqual({
			service: "Netflix",
			title: "Stranger Things",
			season: 4,
			episode: 1,
			paused: false,
			mode: "playing",
			coverUrl: null,
		});
		expect(formatPopupWatchDetail(requireWatch(watch))).toBe("S4 E1 · Netflix");
	});

	test("the catalogue is exploring, and a title page is viewing", () => {
		const home = popupWatchFromMessage(
			activity({
				senseMedia: null,
				pagePath: "/browse",
				activity: {
					details: "Browsing...",
					state: null,
					largeImageKey: null,
					largeImageText: null,
					smallImageKey: null,
					smallImageText: "Browsing",
					startTimestamp: null,
					endTimestamp: null,
					name: null,
					type: 3,
				},
			}),
		);
		expect(home?.mode).toBe("exploring");
		expect(home?.title).toBe("Netflix");
		const page = popupWatchFromMessage(
			activity({
				senseMedia: null,
				pagePath: "/title/123",
				activity: {
					details: "The Penguin",
					state: null,
					largeImageKey: null,
					largeImageText: null,
					smallImageKey: null,
					smallImageText: "Browsing",
					startTimestamp: null,
					endTimestamp: null,
					name: null,
					type: 3,
				},
			}),
		);
		expect(page?.mode).toBe("viewing");
		expect(page?.title).toBe("The Penguin");
	});

	test("a movie has no episode mark", () => {
		const watch = popupWatchFromMessage(
			activity({
				service: "Max",
				senseMedia: {
					provider: "max",
					kind: "movie",
					title: "Dune",
					season: null,
					episode: null,
					positionSec: 10,
					durationSec: 9000,
				},
			}),
		);
		expect(watch?.title).toBe("Dune");
		expect(formatPopupWatchDetail(requireWatch(watch))).toBe("Max");
	});

	test("pause is called out", () => {
		const watch = popupWatchFromMessage(
			activity({
				activity: {
					details: null,
					state: null,
					largeImageKey: null,
					largeImageText: null,
					smallImageKey: "https://cdn.example/pause.png",
					smallImageText: "Paused",
					startTimestamp: null,
					endTimestamp: null,
					name: "Stranger Things",
					type: 3,
				},
			}),
		);
		expect(formatPopupWatchDetail(requireWatch(watch))).toBe("S4 E1 · Netflix");
	});

	test("leaving the player clears the popup", () => {
		expect(
			popupWatchFromMessage({
				type: "sense-companion:clear",
				service: "Netflix",
			}),
		).toBeNull();
	});
});

describe("readPopupWatch", () => {
	test("rejects a stored value that is not a watch", () => {
		expect(readPopupWatch(null)).toBeNull();
		expect(readPopupWatch({ title: "" })).toBeNull();
	});
});
