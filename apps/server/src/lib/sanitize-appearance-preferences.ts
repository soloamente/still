import { type AppThemeId, appThemeTier, isAppThemeId } from "./app-themes";
import {
	isProfileAccentId,
	isProfileBannerFrameId,
	PROFILE_PREF_BANNER_FRAME,
	PROFILE_PREF_PROFILE_ACCENT,
} from "./profile-appearance";

export const PROFILE_PREF_APP_THEME = "appTheme";

/** Legacy keys — stripped on PATCH so old profiles do not keep confusing booth prefs. */
const LEGACY_CINEMA_PREF_KEYS = [
	"cinemaPreset",
	"cinemaPresetUserOverride",
] as const;

/**
 * Validates appearance keys on profile PATCH. Returns merged preferences or an
 * error message for HTTP 400/403.
 */
export function sanitizeAppearancePreferences(
	merged: Record<string, unknown>,
	isPro: boolean,
):
	| { ok: true; preferences: Record<string, unknown> }
	| { ok: false; error: string; status: 400 | 403 } {
	const next = { ...merged };

	for (const key of LEGACY_CINEMA_PREF_KEYS) {
		delete next[key];
	}

	if (PROFILE_PREF_APP_THEME in next) {
		const raw = next[PROFILE_PREF_APP_THEME];
		if (!isAppThemeId(raw)) {
			return { ok: false, error: "Invalid app theme", status: 400 };
		}
		const tier = appThemeTier(raw as AppThemeId);
		if (tier === "pro" && !isPro) {
			return { ok: false, error: "Theme requires Immersed", status: 403 };
		}
	}

	if (PROFILE_PREF_PROFILE_ACCENT in next) {
		if (!isProfileAccentId(next[PROFILE_PREF_PROFILE_ACCENT])) {
			return { ok: false, error: "Invalid profile accent", status: 400 };
		}
		if (!isPro) {
			return {
				ok: false,
				error: "Profile accent requires Immersed",
				status: 403,
			};
		}
	}

	if (PROFILE_PREF_BANNER_FRAME in next) {
		if (!isProfileBannerFrameId(next[PROFILE_PREF_BANNER_FRAME])) {
			return { ok: false, error: "Invalid banner frame", status: 400 };
		}
		if (!isPro) {
			return {
				ok: false,
				error: "Banner frame requires Immersed",
				status: 403,
			};
		}
	}

	return { ok: true, preferences: next };
}
