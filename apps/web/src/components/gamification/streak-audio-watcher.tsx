"use client";

import { useEffect, useRef } from "react";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { api } from "@/lib/api";
import {
	mergeProfileAudioPreferences,
	PROFILE_PREF_AUDIO,
	PROFILE_PREF_THEATER_AUDIO,
	STREAK_AUDIO_MILESTONES,
	type StreakAudioMilestone,
} from "@/lib/profile-audio-preferences";
import { useWatchStreak } from "@/lib/use-watch-streak";

function isStreakAudioMilestone(value: number): value is StreakAudioMilestone {
	return (STREAK_AUDIO_MILESTONES as readonly number[]).includes(value);
}

/**
 * One-shot feedback when a diary streak hits 7 / 30 / 100 days.
 * Persists celebrated milestones so refresh does not replay the cue.
 */
export function StreakAudioWatcher() {
	const { play, audioPreferences, preferencesLoaded, setAudioPreferences } =
		useCinematicAudio();
	const { streak, loading, reload } = useWatchStreak();
	const prevStreakRef = useRef<number | null>(null);
	const skipNextTransitionRef = useRef(true);
	const persistLockRef = useRef(false);

	/** Refresh streak after logs without wiring every diary mutation site. */
	useEffect(() => {
		const interval = window.setInterval(() => {
			void reload();
		}, 45_000);
		const onFocus = () => {
			void reload();
		};
		window.addEventListener("focus", onFocus);
		return () => {
			window.clearInterval(interval);
			window.removeEventListener("focus", onFocus);
		};
	}, [reload]);

	useEffect(() => {
		if (!preferencesLoaded || loading || !streak) return;

		const current = streak.currentStreak;
		const previous = prevStreakRef.current;

		if (skipNextTransitionRef.current) {
			skipNextTransitionRef.current = false;
			prevStreakRef.current = current;
			return;
		}

		if (previous === current) return;
		prevStreakRef.current = current;

		if (!isStreakAudioMilestone(current)) return;
		if (audioPreferences.streakMilestonesCelebrated.includes(current)) return;
		if (previous !== null && current <= previous) return;

		void play("streak-ping", { category: "feedback" }).catch(() => undefined);

		const nextCelebrated = [
			...new Set([...audioPreferences.streakMilestonesCelebrated, current]),
		].filter(isStreakAudioMilestone);

		const nextPreferences = mergeProfileAudioPreferences(
			{},
			{
				...audioPreferences,
				streakMilestonesCelebrated: nextCelebrated,
			},
		);

		setAudioPreferences({
			...audioPreferences,
			streakMilestonesCelebrated: nextCelebrated,
		});

		if (persistLockRef.current) return;
		persistLockRef.current = true;
		void api.api.profiles.me
			.patch({
				preferences: {
					[PROFILE_PREF_AUDIO]: nextPreferences[PROFILE_PREF_AUDIO],
					[PROFILE_PREF_THEATER_AUDIO]:
						nextPreferences[PROFILE_PREF_THEATER_AUDIO],
				},
			})
			.catch(() => undefined)
			.finally(() => {
				persistLockRef.current = false;
			});
	}, [
		audioPreferences,
		loading,
		play,
		preferencesLoaded,
		setAudioPreferences,
		streak,
	]);

	return null;
}
