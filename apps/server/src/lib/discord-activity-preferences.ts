/**
 * Discord activity toggle under `profile.preferences.integrations`.
 * Mirrors web `profile-preferences.ts` for PATCH coercion on the server.
 */

export const PROFILE_PREF_INTEGRATIONS = "integrations" as const;

export const PROFILE_PREF_DISCORD_ACTIVITY_ENABLED =
	"discordActivityEnabled" as const;

function readIntegrationsObject(
	preferences: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
	const raw = preferences?.[PROFILE_PREF_INTEGRATIONS];
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return {};
	}
	return raw as Record<string, unknown>;
}

/**
 * Whether Discord activity may show on profile when linked.
 * Defaults to true when unset so connect flows can opt patrons in immediately.
 */
export function readDiscordActivityEnabledPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	const raw =
		readIntegrationsObject(preferences)[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED];
	if (typeof raw === "boolean") return raw;
	return true;
}

/** Merge the Discord activity toggle without clobbering sibling integration keys. */
export function mergeDiscordActivityEnabledPref(
	existing: Record<string, unknown>,
	enabled: boolean,
): Record<string, unknown> {
	const integrations = readIntegrationsObject(existing);
	return {
		...existing,
		[PROFILE_PREF_INTEGRATIONS]: {
			...integrations,
			[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED]: enabled,
		},
	};
}

/**
 * Deep-merge nested `integrations` after shallow preferences merge on PATCH
 * `/profiles/me` and drop invalid boolean values.
 */
export function sanitizeDiscordActivityPreferences(
	existingPreferences: Record<string, unknown>,
	mergedPreferences: Record<string, unknown>,
): Record<string, unknown> {
	if (!(PROFILE_PREF_INTEGRATIONS in mergedPreferences)) {
		return mergedPreferences;
	}

	const mergedTop: Record<string, unknown> = {
		...existingPreferences,
		...mergedPreferences,
	};

	const patchIntegrations = mergedPreferences[PROFILE_PREF_INTEGRATIONS];
	const nextIntegrations = {
		...readIntegrationsObject(existingPreferences),
		...(patchIntegrations &&
		typeof patchIntegrations === "object" &&
		!Array.isArray(patchIntegrations)
			? (patchIntegrations as Record<string, unknown>)
			: {}),
	};

	const raw = nextIntegrations[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED];
	if (raw !== undefined && typeof raw !== "boolean") {
		delete nextIntegrations[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED];
	}

	return {
		...mergedTop,
		[PROFILE_PREF_INTEGRATIONS]: nextIntegrations,
	};
}
