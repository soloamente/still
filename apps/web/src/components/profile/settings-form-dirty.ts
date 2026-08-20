import type { AppThemeClass } from "@/lib/app-themes";
import { resolveAppThemeForPatron } from "@/lib/app-themes";
import { normalizeProfileBirthDateYmd } from "@/lib/normalize-profile-birth-date";
import {
	NOTIFICATION_KIND_SETTINGS,
	type NotificationKind,
	readNotificationPrefsFromProfile,
} from "@/lib/notification-preferences";
import {
	inferProfileAccentFromHex,
	type ProfileAccentId,
	type ProfileBannerFrameId,
	readProfileAccentPref,
	readProfileBannerFramePref,
} from "@/lib/profile-appearance";
import { readProfileAudioPreferences } from "@/lib/profile-audio-preferences";
import {
	type ProfilePresenceVisibilityPref,
	readAppThemePref,
	readCastCrewMonochromeOnHoverPref,
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbLanguagePref,
	readCatalogTmdbWatchRegionPref,
	readDiscordActivityEnabledPref,
	readProfilePortraitGrayscaleUntilHoverPref,
	readProfilePresenceVisibilityPref,
	readReviewTranslationLanguagePref,
	readShowAdultContentPref,
	readShowBirthDateOnProfilePref,
	readSmoothScrollPref,
	readWatchlistStreamingAlertsPref,
} from "@/lib/profile-preferences";

/** Fields that drive Settings Save/Cancel — compared to a committed baseline. */
export type SettingsFormDirtySnapshot = {
	displayName: string;
	bio: string;
	pronouns: string;
	location: string;
	website: string;
	birthDate: string;
	showBirthDateOnProfile: boolean;
	presenceVisibility: ProfilePresenceVisibilityPref;
	discordActivityEnabled: boolean;
	isPrivate: boolean;
	audioEnabled: boolean;
	audioAtmosphere: boolean;
	audioFeedback: boolean;
	smoothScroll: boolean;
	castCrewMonochromeOnHover: boolean;
	profilePortraitGrayscaleUntilHover: boolean;
	catalogMonochromePeersOnHover: boolean;
	showAdultContent: boolean;
	catalogTmdbWatchRegion: string;
	catalogTmdbLanguage: string;
	reviewTranslationLanguage: string;
	watchlistStreamingAlerts: boolean;
	appTheme: AppThemeClass;
	profileAccent: ProfileAccentId | null;
	bannerFrame: ProfileBannerFrameId;
	notificationPrefs: Record<NotificationKind, boolean>;
};

export type SettingsFormDirtyProfileInput = {
	displayName?: string | null;
	bio?: string | null;
	pronouns?: string | null;
	location?: string | null;
	website?: string | null;
	birthDate?: string | null;
	isPrivate: boolean;
	accentColor?: string | null;
	preferences?: Record<string, unknown> | null;
};

function catalogRegionFromPref(
	preferences: Record<string, unknown> | null | undefined,
): string {
	const region = readCatalogTmdbWatchRegionPref(preferences ?? null);
	if (region === null) return "";
	return region === "ALL" ? "ALL" : region;
}

/** Server/profile snapshot used until the patron saves in this session. */
export function snapshotSettingsFormFromProfile(
	profile: SettingsFormDirtyProfileInput,
	isPro: boolean,
): SettingsFormDirtySnapshot {
	const preferences = profile.preferences ?? null;
	const audio = readProfileAudioPreferences(preferences);
	return {
		displayName: (profile.displayName ?? "").trim(),
		bio: (profile.bio ?? "").trim(),
		pronouns: (profile.pronouns ?? "").trim(),
		location: (profile.location ?? "").trim(),
		website: (profile.website ?? "").trim(),
		birthDate: normalizeProfileBirthDateYmd(profile.birthDate) ?? "",
		showBirthDateOnProfile: readShowBirthDateOnProfilePref(preferences),
		presenceVisibility: readProfilePresenceVisibilityPref(preferences),
		discordActivityEnabled: readDiscordActivityEnabledPref(preferences),
		isPrivate: Boolean(profile.isPrivate),
		audioEnabled: audio.enabled,
		audioAtmosphere: audio.atmosphere,
		audioFeedback: audio.feedback,
		smoothScroll: readSmoothScrollPref(preferences),
		castCrewMonochromeOnHover: readCastCrewMonochromeOnHoverPref(preferences),
		profilePortraitGrayscaleUntilHover:
			readProfilePortraitGrayscaleUntilHoverPref(preferences),
		catalogMonochromePeersOnHover:
			readCatalogMonochromePeersOnHoverPref(preferences),
		showAdultContent: readShowAdultContentPref(preferences),
		catalogTmdbWatchRegion: catalogRegionFromPref(preferences),
		catalogTmdbLanguage: readCatalogTmdbLanguagePref(preferences) ?? "",
		reviewTranslationLanguage:
			readReviewTranslationLanguagePref(preferences) ?? "",
		watchlistStreamingAlerts: readWatchlistStreamingAlertsPref(preferences),
		appTheme: resolveAppThemeForPatron(readAppThemePref(preferences), isPro),
		profileAccent:
			readProfileAccentPref(preferences) ??
			inferProfileAccentFromHex(profile.accentColor),
		bannerFrame: readProfileBannerFramePref(preferences),
		notificationPrefs: readNotificationPrefsFromProfile(preferences),
	};
}

export function settingsFormSnapshotsEqual(
	left: SettingsFormDirtySnapshot,
	right: SettingsFormDirtySnapshot,
): boolean {
	if (
		left.displayName !== right.displayName ||
		left.bio !== right.bio ||
		left.pronouns !== right.pronouns ||
		left.location !== right.location ||
		left.website !== right.website ||
		left.birthDate !== right.birthDate ||
		left.showBirthDateOnProfile !== right.showBirthDateOnProfile ||
		left.presenceVisibility !== right.presenceVisibility ||
		left.discordActivityEnabled !== right.discordActivityEnabled ||
		left.isPrivate !== right.isPrivate ||
		left.audioEnabled !== right.audioEnabled ||
		left.audioAtmosphere !== right.audioAtmosphere ||
		left.audioFeedback !== right.audioFeedback ||
		left.smoothScroll !== right.smoothScroll ||
		left.castCrewMonochromeOnHover !== right.castCrewMonochromeOnHover ||
		left.profilePortraitGrayscaleUntilHover !==
			right.profilePortraitGrayscaleUntilHover ||
		left.catalogMonochromePeersOnHover !==
			right.catalogMonochromePeersOnHover ||
		left.showAdultContent !== right.showAdultContent ||
		left.catalogTmdbWatchRegion !== right.catalogTmdbWatchRegion ||
		left.catalogTmdbLanguage !== right.catalogTmdbLanguage ||
		left.reviewTranslationLanguage !== right.reviewTranslationLanguage ||
		left.watchlistStreamingAlerts !== right.watchlistStreamingAlerts ||
		left.appTheme !== right.appTheme ||
		left.profileAccent !== right.profileAccent ||
		left.bannerFrame !== right.bannerFrame
	) {
		return false;
	}
	return NOTIFICATION_KIND_SETTINGS.every(
		(kind) =>
			left.notificationPrefs[kind.id] === right.notificationPrefs[kind.id],
	);
}

/** True when the live form differs from the last committed (or profile) snapshot. */
export function settingsFormIsDirty(
	current: SettingsFormDirtySnapshot,
	baseline: SettingsFormDirtySnapshot,
	hasPendingMedia: boolean,
): boolean {
	return hasPendingMedia || !settingsFormSnapshotsEqual(current, baseline);
}
