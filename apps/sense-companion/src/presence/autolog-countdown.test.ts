import { describe, expect, test } from "bun:test";
import {
	AUTOLOG_SENTENCE_MS,
	type AutologMediaClock,
	autologRemainingSec,
	autologRingProgress,
	emptyAutologCountdownState,
	formatAutologClock,
	formatAutologMinutes,
	nextAutologCountdown,
} from "./autolog-countdown";

function media(remainingSec: number, episode = 1): AutologMediaClock {
	const durationSec = 6_000;
	return {
		provider: "netflix",
		kind: "episode",
		title: "The Penguin",
		season: 1,
		episode,
		positionSec: durationSec * 0.9 - remainingSec,
		durationSec,
	};
}

describe("autolog countdown", () => {
	test("remaining time is 90 percent of the runtime minus the playhead", () => {
		expect(autologRemainingSec(5_300, 6_000)).toBe(100);
		expect(autologRemainingSec(null, 6_000)).toBeNull();
		expect(autologRemainingSec(100, 500)).toBeNull();
		expect(autologRemainingSec(Number.NaN, 6_000)).toBeNull();
	});

	test("the badge rounds up and the clock pads seconds", () => {
		expect(formatAutologMinutes(12 * 60)).toBe("12 min");
		expect(formatAutologMinutes(61)).toBe("2 min");
		expect(formatAutologMinutes(1)).toBe("1 min");
		expect(formatAutologClock(12 * 60 + 4)).toBe("12:04");
		expect(formatAutologClock(42)).toBe("0:42");
		expect(autologRingProgress(15 * 60)).toBe(0);
		expect(autologRingProgress(0)).toBe(1);
		expect(autologRingProgress(7.5 * 60)).toBeCloseTo(0.5);
	});

	test("the first time inside the window is the sentence", () => {
		const decision = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		expect(decision.phase).toBe("sentence");
		expect(decision.remainingSec).toBe(12 * 60);
		expect(decision.state.sentenceStartedAt).toBe(1_000);
	});

	test("four seconds later the same title is the clock", () => {
		const first = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		const later = nextAutologCountdown({
			state: first.state,
			now: 1_000 + AUTOLOG_SENTENCE_MS,
			paired: true,
			paused: false,
			logged: false,
			media: media(11 * 60),
		});
		expect(later.phase).toBe("clock");
		expect(later.state.sentenceShown).toBe(true);
		expect(later.remainingSec).toBe(11 * 60);
	});

	test("pause keeps the last remaining time", () => {
		const playing = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(100),
		});
		const paused = nextAutologCountdown({
			state: playing.state,
			now: 2_000,
			paired: true,
			paused: true,
			logged: false,
			media: media(80),
		});
		expect(paused.remainingSec).toBe(100);
		const still = nextAutologCountdown({
			state: paused.state,
			now: 3_000,
			paired: true,
			paused: true,
			logged: false,
			media: media(40),
		});
		expect(still.remainingSec).toBe(100);
	});

	test("seeking out hides the pill and seeking back skips the sentence", () => {
		const first = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		const shown = nextAutologCountdown({
			state: first.state,
			now: 1_000 + AUTOLOG_SENTENCE_MS,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		expect(shown.phase).toBe("clock");
		const outside = nextAutologCountdown({
			state: shown.state,
			now: 9_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(16 * 60),
		});
		expect(outside.phase).toBe("hidden");
		const back = nextAutologCountdown({
			state: outside.state,
			now: 10_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		expect(back.phase).toBe("clock");
	});

	test("pause does not restart the sentence timer", () => {
		const first = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(100),
		});
		const paused = nextAutologCountdown({
			state: first.state,
			now: 1_000 + AUTOLOG_SENTENCE_MS,
			paired: true,
			paused: true,
			logged: false,
			media: media(90),
		});
		expect(paused.phase).toBe("clock");
		expect(paused.remainingSec).toBe(100);
	});

	test("a new episode shows the sentence again", () => {
		const shown = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 5_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60, 1),
		});
		const finished = nextAutologCountdown({
			state: shown.state,
			now: 5_000 + AUTOLOG_SENTENCE_MS,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60, 1),
		});
		const nextEpisode = nextAutologCountdown({
			state: finished.state,
			now: 9_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60, 2),
		});
		expect(nextEpisode.phase).toBe("sentence");
	});

	test("unpaired, logged, too early, and finished all hide", () => {
		const base = {
			state: emptyAutologCountdownState(),
			now: 1_000,
			paused: false,
			media: media(12 * 60),
		};
		expect(
			nextAutologCountdown({ ...base, paired: false, logged: false }).phase,
		).toBe("hidden");
		expect(
			nextAutologCountdown({ ...base, paired: true, logged: true }).phase,
		).toBe("hidden");
		expect(
			nextAutologCountdown({
				...base,
				paired: true,
				logged: false,
				media: media(16 * 60),
			}).phase,
		).toBe("hidden");
		expect(
			nextAutologCountdown({
				...base,
				paired: true,
				logged: false,
				media: media(0),
			}).phase,
		).toBe("hidden");
		expect(
			nextAutologCountdown({
				...base,
				paired: true,
				logged: false,
				media: null,
			}).phase,
		).toBe("hidden");
	});
});
