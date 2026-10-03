import { describe, expect, test } from "bun:test";

import type { PopupWatch } from "../popup/watch-state";
import {
	emptyWatchToastState,
	nextWatchToast,
	playingNoticeStillCurrent,
	watchDeliveryOk,
	watchToastCopy,
} from "./watch-toast";

function watch(overrides: Partial<PopupWatch> = {}): PopupWatch {
	return {
		service: "Netflix",
		title: "Stranger Things",
		season: 4,
		episode: 1,
		paused: false,
		mode: "playing",
		coverUrl: null,
		...overrides,
	};
}

describe("watch toast", () => {
	test("playingNoticeStillCurrent when keys match, not when null or different", () => {
		expect(playingNoticeStillCurrent("playing\0Title", "playing\0Title")).toBe(
			true,
		);
		expect(playingNoticeStillCurrent(null, "playing\0Title")).toBe(false);
		expect(playingNoticeStillCurrent("paused\0Title", "playing\0Title")).toBe(
			false,
		);
	});

	test("the check is only for a paired save the helper accepted", () => {
		expect(watchDeliveryOk({ paired: true, posted: true })).toBe(true);
		expect(watchDeliveryOk({ paired: false, posted: true })).toBe(false);
		expect(watchDeliveryOk({ paired: true, posted: false })).toBe(false);
	});

	test("names the title that just started", () => {
		expect(watchToastCopy(watch(), false)).toEqual({
			lead: "Watching",
			title: "Stranger Things",
			detail: "S4 E1",
			icon: "eye",
		});
		expect(
			watchToastCopy(
				watch({ title: "Dune", season: null, episode: null }),
				false,
			),
		).toEqual({ lead: "Watching", title: "Dune", detail: null, icon: "eye" });
	});

	test("shows once when playback starts, then stays quiet", () => {
		const first = nextWatchToast(emptyWatchToastState(), watch());
		expect(first.show).toBe(true);
		const again = nextWatchToast(first.state, watch());
		expect(again.show).toBe(false);
		expect(again.state.key).toBe(first.state.key);
	});

	test("pause and resume each get their own notice", () => {
		const started = nextWatchToast(emptyWatchToastState(), watch());
		const paused = nextWatchToast(
			started.state,
			watch({ paused: true, mode: "paused" }),
		);
		expect(paused.show).toBe(true);
		expect(
			watchToastCopy(watch({ paused: true, mode: "paused" }), false).icon,
		).toBe("pause");
		const resumed = nextWatchToast(paused.state, watch());
		expect(resumed.show).toBe(true);
		expect(resumed.resume).toBe(true);
		expect(watchToastCopy(watch(), true)).toEqual({
			lead: "Resuming",
			title: "Stranger Things",
			detail: "S4 E1",
			icon: "play",
		});
	});

	test("a pause before play is ignored", () => {
		const paused = nextWatchToast(
			emptyWatchToastState(),
			watch({ paused: true, mode: "paused" }),
		);
		expect(paused.show).toBe(false);
		expect(paused.resume).toBe(false);
		expect(paused.state).toEqual(emptyWatchToastState());
		const started = nextWatchToast(paused.state, watch());
		expect(started.show).toBe(true);
		expect(started.resume).toBe(false);
		expect(watchToastCopy(watch(), started.resume)).toEqual({
			lead: "Watching",
			title: "Stranger Things",
			detail: "S4 E1",
			icon: "eye",
		});
		const moviePause = nextWatchToast(
			emptyWatchToastState(),
			watch({
				title: "Dune",
				season: null,
				episode: null,
				paused: true,
				mode: "paused",
			}),
		);
		expect(moviePause.show).toBe(false);
		expect(moviePause.state).toEqual(emptyWatchToastState());
	});

	test("a pause on the next episode is ignored until it plays", () => {
		const started = nextWatchToast(emptyWatchToastState(), watch());
		const paused = nextWatchToast(
			started.state,
			watch({ paused: true, mode: "paused" }),
		);
		const early = nextWatchToast(
			paused.state,
			watch({ episode: 2, paused: true, mode: "paused" }),
		);
		expect(early.show).toBe(false);
		expect(early.state).toEqual(paused.state);
		const played = nextWatchToast(early.state, watch({ episode: 2 }));
		expect(played.show).toBe(true);
		expect(played.resume).toBe(false);
		expect(watchToastCopy(watch({ episode: 2 }), played.resume)).toEqual({
			lead: "Watching",
			title: "Stranger Things",
			detail: "S4 E2",
			icon: "eye",
		});
	});

	test("leaving the player starts the next play at Watching", () => {
		const started = nextWatchToast(emptyWatchToastState(), watch());
		const left = nextWatchToast(started.state, null);
		const returned = nextWatchToast(left.state, watch());
		expect(returned.show).toBe(true);
		expect(returned.resume).toBe(false);
		expect(watchToastCopy(watch(), returned.resume).lead).toBe("Watching");
		expect(watchToastCopy(watch(), returned.resume).icon).toBe("eye");
	});

	test("a paused episode without a number does not count", () => {
		const partial = nextWatchToast(
			emptyWatchToastState(),
			watch({ episode: null, paused: true, mode: "paused" }),
		);
		expect(partial.show).toBe(false);
		expect(partial.resume).toBe(false);
		expect(partial.state).toEqual(emptyWatchToastState());
	});

	test("shows again for a different episode and after leaving the player", () => {
		const started = nextWatchToast(emptyWatchToastState(), watch());
		const nextEpisode = nextWatchToast(started.state, watch({ episode: 2 }));
		expect(nextEpisode.show).toBe(true);
		const left = nextWatchToast(nextEpisode.state, null);
		expect(left.state.key).toBeNull();
		const returned = nextWatchToast(left.state, watch({ episode: 2 }));
		expect(returned.show).toBe(true);
	});

	test("waits until an episode number exists", () => {
		const partial = nextWatchToast(
			emptyWatchToastState(),
			watch({ episode: null }),
		);
		expect(partial.show).toBe(false);
		const ready = nextWatchToast(partial.state, watch());
		expect(ready.show).toBe(true);
	});
});
