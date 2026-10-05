/**
 * Companion "share what I'm watching" lives in its own module so Settings can
 * read it even when a stale client bundle of `profile-preferences` is missing
 * the newer export.
 * Key must stay aligned with `PROFILE_PREF_INTEGRATIONS` in profile-preferences.
 */
export const PROFILE_PREF_COMPANION_WATCHING_ENABLED =
	"companionWatchingEnabled" as const;

const PROFILE_PREF_INTEGRATIONS = "integrations";

function readIntegrationsObject(
	preferences: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
	const raw = preferences?.[PROFILE_PREF_INTEGRATIONS];
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return {};
	}
	return raw as Record<string, unknown>;
}

/** Sense Companion profile row — default on until the patron turns sharing off. */
export function readCompanionWatchingEnabledPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	const raw =
		readIntegrationsObject(preferences)[
			PROFILE_PREF_COMPANION_WATCHING_ENABLED
		];
	if (typeof raw === "boolean") return raw;
	return true;
}

/** Merge the Companion share toggle without wiping sibling integration keys. */
export function mergeCompanionWatchingEnabledPref(
	existing: Record<string, unknown>,
	enabled: boolean,
): Record<string, unknown> {
	const integrations = readIntegrationsObject(existing);
	return {
		...existing,
		[PROFILE_PREF_INTEGRATIONS]: {
			...integrations,
			[PROFILE_PREF_COMPANION_WATCHING_ENABLED]: enabled,
		},
	};
}
