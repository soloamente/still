/**
 * Patron audio preferences under `profile.preferences`.
 * Migrates legacy `theaterAudio` into nested `audio` for atmosphere vs feedback toggles.
 */

/** Nested object key — atmosphere (hum) and feedback (clacks/chimes) live here. */
export const PROFILE_PREF_AUDIO = "audio" as const;

/** Legacy boolean kept in sync with `audio.enabled` for one release cycle. */
export const PROFILE_PREF_THEATER_AUDIO = "theaterAudio" as const;

/** Streak lengths that trigger a one-shot feedback cue (see sound-layer spec). */
export const STREAK_AUDIO_MILESTONES = [7, 30, 100] as const;

export type StreakAudioMilestone = (typeof STREAK_AUDIO_MILESTONES)[number];

export type ProfileAudioPreferences = {
	enabled: boolean;
	atmosphere: boolean;
	feedback: boolean;
	streakMilestonesCelebrated: number[];
};

function isStreakMilestone(value: number): value is StreakAudioMilestone {
	return (STREAK_AUDIO_MILESTONES as readonly number[]).includes(value);
}

/** Keep only valid milestone integers persisted by StreakAudioWatcher. */
function normalizeStreakMilestonesCelebrated(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(entry): entry is StreakAudioMilestone =>
			typeof entry === "number" && isStreakMilestone(entry),
	);
}

/**
 * Normalize opaque profile JSON into a stable audio prefs shape.
 * Prefers nested `audio`; falls back to legacy `theaterAudio === true`.
 */
export function readProfileAudioPreferences(
	prefs: Record<string, unknown> | null | undefined,
): ProfileAudioPreferences {
	const raw = prefs?.[PROFILE_PREF_AUDIO];
	if (raw && typeof raw === "object" && !Array.isArray(raw)) {
		const nested = raw as Record<string, unknown>;
		const enabled = nested.enabled === true;
		return {
			enabled,
			// Sub-toggles default on when master is enabled unless explicitly false.
			atmosphere: enabled && nested.atmosphere !== false,
			feedback: enabled && nested.feedback !== false,
			streakMilestonesCelebrated: normalizeStreakMilestonesCelebrated(
				nested.streakMilestonesCelebrated,
			),
		};
	}

	const legacyEnabled = prefs?.[PROFILE_PREF_THEATER_AUDIO] === true;
	return {
		enabled: legacyEnabled,
		atmosphere: legacyEnabled,
		feedback: legacyEnabled,
		streakMilestonesCelebrated: [],
	};
}

/** Merge nested audio prefs and mirror `theaterAudio` for backward compatibility. */
export function mergeProfileAudioPreferences(
	existing: Record<string, unknown>,
	audio: ProfileAudioPreferences,
): Record<string, unknown> {
	return {
		...existing,
		[PROFILE_PREF_AUDIO]: {
			enabled: audio.enabled,
			atmosphere: audio.atmosphere,
			feedback: audio.feedback,
			streakMilestonesCelebrated: audio.streakMilestonesCelebrated,
		},
		[PROFILE_PREF_THEATER_AUDIO]: audio.enabled,
	};
}
