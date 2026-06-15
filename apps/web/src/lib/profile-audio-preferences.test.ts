import { describe, expect, test } from "bun:test";

import {
	mergeProfileAudioPreferences,
	PROFILE_PREF_AUDIO,
	PROFILE_PREF_THEATER_AUDIO,
	readProfileAudioPreferences,
} from "./profile-audio-preferences";

describe("readProfileAudioPreferences", () => {
	test("defaults all off", () => {
		expect(readProfileAudioPreferences(null)).toEqual({
			enabled: false,
			atmosphere: false,
			feedback: false,
			streakMilestonesCelebrated: [],
		});
	});

	test("migrates legacy theaterAudio true", () => {
		expect(readProfileAudioPreferences({ theaterAudio: true })).toEqual({
			enabled: true,
			atmosphere: true,
			feedback: true,
			streakMilestonesCelebrated: [],
		});
	});

	test("reads nested audio object", () => {
		expect(
			readProfileAudioPreferences({
				audio: { enabled: true, atmosphere: false, feedback: true },
			}),
		).toEqual({
			enabled: true,
			atmosphere: false,
			feedback: true,
			streakMilestonesCelebrated: [],
		});
	});
});

describe("mergeProfileAudioPreferences", () => {
	test("writes audio + legacy theaterAudio", () => {
		const next = mergeProfileAudioPreferences(
			{ foo: 1 },
			{
				enabled: true,
				atmosphere: true,
				feedback: false,
				streakMilestonesCelebrated: [7],
			},
		);
		expect(next.foo).toBe(1);
		expect(next[PROFILE_PREF_AUDIO]).toEqual({
			enabled: true,
			atmosphere: true,
			feedback: false,
			streakMilestonesCelebrated: [7],
		});
		expect(next[PROFILE_PREF_THEATER_AUDIO]).toBe(true);
	});
});
