/**
 * Settings IA — which tab owns a preference in the UI.
 * Storage keys stay on `profile.preferences`; this map is for placement + copy.
 */
export const ME_SETTINGS_PREF_HOME = {
	profilePortraitGrayscaleUntilHover: "/me/settings/appearance",
	catalogMonochromePeersOnHover: "/me/settings/appearance",
	castCrewMonochromeOnHover: "/me/settings/appearance",
	showAdultContent: "/me/settings/catalogue",
} as const;

export type MeSettingsPrefHomeKey = keyof typeof ME_SETTINGS_PREF_HOME;

/** Settings tab that should render the control for this preference. */
export function meSettingsHomeForPref(
	key: MeSettingsPrefHomeKey,
): (typeof ME_SETTINGS_PREF_HOME)[MeSettingsPrefHomeKey] {
	return ME_SETTINGS_PREF_HOME[key];
}
