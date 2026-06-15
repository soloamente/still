/**
 * Patron audio preferences under `profile.preferences`.
 * Mirrors web `profile-audio-preferences.ts` for PATCH coercion on the server.
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

/** Deep-merge nested `audio` so partial PATCHes do not wipe sibling keys. */
function mergeAudioPreferencePatch(
	existing: Record<string, unknown>,
	patch: Record<string, unknown>,
): Record<string, unknown> {
	const mergedTop: Record<string, unknown> = { ...existing, ...patch };
	const patchAudio = patch[PROFILE_PREF_AUDIO];
	if (
		patchAudio &&
		typeof patchAudio === "object" &&
		!Array.isArray(patchAudio)
	) {
		const existingAudio = existing[PROFILE_PREF_AUDIO];
		const baseAudio =
			existingAudio &&
			typeof existingAudio === "object" &&
			!Array.isArray(existingAudio)
				? (existingAudio as Record<string, unknown>)
				: {};
		mergedTop[PROFILE_PREF_AUDIO] = {
			...baseAudio,
			...(patchAudio as Record<string, unknown>),
		};
	}
	return mergedTop;
}

/**
 * Coerce audio prefs after shallow preferences merge on PATCH `/profiles/me`.
 * Returns the same object reference when no audio keys were touched.
 */
export function sanitizeProfileAudioPreferences(
	existingPreferences: Record<string, unknown>,
	mergedPreferences: Record<string, unknown>,
): Record<string, unknown> {
	const touched =
		PROFILE_PREF_AUDIO in mergedPreferences ||
		PROFILE_PREF_THEATER_AUDIO in mergedPreferences;
	if (!touched) return mergedPreferences;

	const deepMerged = mergeAudioPreferencePatch(
		existingPreferences,
		mergedPreferences,
	);
	const normalized = readProfileAudioPreferences(deepMerged);
	return mergeProfileAudioPreferences(deepMerged, normalized);
}
