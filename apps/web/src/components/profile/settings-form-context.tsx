"use client";

import type { PlanFeatureKey, PlanTierId } from "@still/plans";
import {
	hasPatronFeatureForTier,
	parsePlanFeatureKeys,
	parsePlanTierId,
} from "@still/plans";
import { useRouter } from "next/navigation";
import {
	createContext,
	type FormEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { useSmoothScrollPreference } from "@/components/lenis-provider";
import { useRegisterMeAccountBarActions } from "@/components/profile/me-account-bar-actions-context";
import {
	clearStoredSettingsDraft,
	readStoredSettingsDraft,
	useMeAccountSession,
	writeStoredSettingsDraft,
} from "@/components/profile/me-account-session-context";
import {
	type SettingsFormDirtySnapshot,
	settingsFormIsDirty,
	settingsFormSnapshotsEqual,
	snapshotSettingsFormFromProfile,
} from "@/components/profile/settings-form-dirty";
import type { ContentVisibility } from "@/components/review/visibility-select";
import { patronMeetsAdultAgeGate } from "@/lib/adult-content-age-gate";
import { api } from "@/lib/api";
import { type AppThemeClass, resolveAppThemeForPatron } from "@/lib/app-themes";
import { authClient } from "@/lib/auth-client";
import {
	EMAIL_VERIFICATION_TOAST,
	isEmailVerificationRequiredError,
} from "@/lib/email-verification-error";
import { normalizeProfileBirthDateYmd } from "@/lib/normalize-profile-birth-date";
import {
	buildNotificationPrefsPatch,
	type NotificationKind,
	readNotificationPrefsFromProfile,
} from "@/lib/notification-preferences";
import {
	inferProfileAccentFromHex,
	PROFILE_PREF_BANNER_FRAME,
	PROFILE_PREF_PROFILE_ACCENT,
	type ProfileAccentId,
	type ProfileBannerFrameId,
	readProfileAccentPref,
	readProfileBannerFramePref,
} from "@/lib/profile-appearance";
import {
	mergeProfileAudioPreferences,
	readProfileAudioPreferences,
} from "@/lib/profile-audio-preferences";
import {
	mergeDiscordActivityEnabledPref,
	PROFILE_PREF_APP_THEME,
	PROFILE_PREF_CAST_CREW_MONOCHROME_ON_HOVER,
	PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER,
	PROFILE_PREF_CATALOG_TMDB_LANGUAGE,
	PROFILE_PREF_CATALOG_TMDB_WATCH_REGION,
	PROFILE_PREF_PRIVACY_PRESENCE_VISIBILITY,
	PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER,
	PROFILE_PREF_REVIEW_TRANSLATION_LANGUAGE,
	PROFILE_PREF_SHOW_ADULT_CONTENT,
	PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE,
	PROFILE_PREF_SMOOTH_SCROLL,
	PROFILE_PREF_WATCHLIST_STREAMING_ALERTS,
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
import { uploadProfileMeAsset } from "@/lib/upload-profile-me-asset";
import { invalidateCastCrewMonochromePrefCache } from "@/lib/use-cast-crew-monochrome-pref";
import { invalidateCatalogTmdbLanguageCache } from "@/lib/use-catalog-tmdb-language";
import { invalidateReviewTranslationLanguageCache } from "@/lib/use-review-translation-language";
import { clearSearchDialogGenreCache } from "@/lib/use-search-dialog-genres";

export type SettingsProfile = {
	handle: string;
	displayName: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
	birthDate?: string | null;
	bannerUrl?: string | null;
	hasAvatar?: boolean;
	isPrivate: boolean;
	isPro?: boolean;
	effectiveTier?: PlanTierId;
	featureGrants?: readonly PlanFeatureKey[];
	subscriptionTier?: PlanTierId;
	planOverride?: PlanTierId | null;
	subscriptionInterval?: "month" | "year" | null;
	subscriptionStatus?: "active" | "past_due" | "canceled" | null;
	polarSubscriptionId?: string | null;
	accentColor?: string | null;
	preferences?: Record<string, unknown> | null;
	defaultVisibility?: ContentVisibility | null;
};

function initialProfileAccent(
	profile: SettingsProfile,
): ProfileAccentId | null {
	return (
		readProfileAccentPref(profile.preferences ?? null) ??
		inferProfileAccentFromHex(profile.accentColor)
	);
}

type SettingsFormContextValue = {
	profile: SettingsProfile;
	isPro: boolean;
	effectiveTier: PlanTierId;
	featureGrants: readonly PlanFeatureKey[];
	hasFeature: (featureKey: PlanFeatureKey) => boolean;
	formRef: RefObject<HTMLFormElement | null>;
	displayName: string;
	setDisplayName: (value: string) => void;
	bio: string;
	setBio: (value: string) => void;
	pronouns: string;
	setPronouns: (value: string) => void;
	location: string;
	setLocation: (value: string) => void;
	website: string;
	setWebsite: (value: string) => void;
	birthDate: string;
	setBirthDate: (value: string) => void;
	showBirthDateOnProfile: boolean;
	setShowBirthDateOnProfile: (value: boolean) => void;
	presenceVisibility: ProfilePresenceVisibilityPref;
	setPresenceVisibility: (value: ProfilePresenceVisibilityPref) => void;
	discordActivityEnabled: boolean;
	setDiscordActivityEnabled: (value: boolean) => void;
	isPrivate: boolean;
	setIsPrivate: (value: boolean) => void;
	profileAudioEnabled: boolean;
	setProfileAudioEnabled: (value: boolean) => void;
	profileAudioAtmosphere: boolean;
	setProfileAudioAtmosphere: (value: boolean) => void;
	profileAudioFeedback: boolean;
	setProfileAudioFeedback: (value: boolean) => void;
	smoothScroll: boolean;
	setSmoothScroll: (value: boolean) => void;
	castCrewMonochromeOnHover: boolean;
	setCastCrewMonochromeOnHover: (value: boolean) => void;
	profilePortraitGrayscaleUntilHover: boolean;
	setProfilePortraitGrayscaleUntilHover: (value: boolean) => void;
	catalogMonochromePeersOnHover: boolean;
	setCatalogMonochromePeersOnHover: (value: boolean) => void;
	catalogTmdbWatchRegion: string;
	setCatalogTmdbWatchRegion: (value: string) => void;
	catalogTmdbLanguage: string;
	setCatalogTmdbLanguage: (value: string) => void;
	reviewTranslationLanguage: string;
	setReviewTranslationLanguage: (value: string) => void;
	watchlistStreamingAlerts: boolean;
	setWatchlistStreamingAlerts: (value: boolean) => void;
	showAdultContent: boolean;
	setShowAdultContent: (value: boolean) => void;
	enableAdultContentWithBirthDate: (birthDateIso: string) => Promise<void>;
	persistShowAdultContent: (enabled: boolean) => Promise<void>;
	appTheme: AppThemeClass;
	setAppTheme: (value: AppThemeClass) => void;
	profileAccent: ProfileAccentId | null;
	setProfileAccent: (value: ProfileAccentId | null) => void;
	bannerFrame: ProfileBannerFrameId;
	setBannerFrame: (value: ProfileBannerFrameId) => void;
	notificationPrefs: ReturnType<typeof readNotificationPrefsFromProfile>;
	setNotificationPref: (kind: NotificationKind, enabled: boolean) => void;
	saving: boolean;
	onSubmit: (e: FormEvent) => Promise<void>;
	resetToProfile: () => void;
};

const SettingsFormContext = createContext<SettingsFormContextValue | null>(
	null,
);

export function SettingsFormProvider({
	profile,
	children,
}: {
	profile: SettingsProfile;
	children: ReactNode;
}) {
	const router = useRouter();
	const isPro = Boolean(profile.isPro);
	const effectiveTier = parsePlanTierId(profile.effectiveTier ?? "still");
	const featureGrants = parsePlanFeatureKeys(profile.featureGrants ?? []);
	const hasFeature = useCallback(
		(featureKey: PlanFeatureKey) =>
			hasPatronFeatureForTier({
				effectiveTier,
				grants: featureGrants,
				featureKey,
			}),
		[effectiveTier, featureGrants],
	);
	const { setAudioPreferences } = useCinematicAudio();
	const { setSmoothScrollEnabled } = useSmoothScrollPreference();
	const {
		syncSettingsDirty,
		syncCustomizationDirty,
		pendingBanner,
		pendingAvatar,
		setPendingBanner,
		setPendingAvatar,
		revokeAllCustomizationPending,
	} = useMeAccountSession();
	const [displayName, setDisplayName] = useState(profile.displayName ?? "");
	const [bio, setBio] = useState(profile.bio ?? "");
	const [pronouns, setPronouns] = useState(profile.pronouns ?? "");
	const [location, setLocation] = useState(profile.location ?? "");
	const [website, setWebsite] = useState(profile.website ?? "");
	const [birthDate, setBirthDate] = useState(
		() => normalizeProfileBirthDateYmd(profile.birthDate) ?? "",
	);
	const [showBirthDateOnProfile, setShowBirthDateOnProfile] = useState(() =>
		readShowBirthDateOnProfilePref(profile.preferences ?? null),
	);
	const [presenceVisibility, setPresenceVisibility] =
		useState<ProfilePresenceVisibilityPref>(() =>
			readProfilePresenceVisibilityPref(profile.preferences ?? null),
		);
	const [discordActivityEnabled, setDiscordActivityEnabled] = useState(() =>
		readDiscordActivityEnabledPref(profile.preferences ?? null),
	);
	const [isPrivate, setIsPrivate] = useState(Boolean(profile.isPrivate));
	const [profileAudio, setProfileAudio] = useState(() =>
		readProfileAudioPreferences(profile.preferences ?? null),
	);
	const setProfileAudioEnabled = useCallback((enabled: boolean) => {
		setProfileAudio((prev) =>
			enabled
				? { ...prev, enabled: true, atmosphere: true, feedback: true }
				: { ...prev, enabled: false, atmosphere: false, feedback: false },
		);
	}, []);
	const setProfileAudioAtmosphere = useCallback((atmosphere: boolean) => {
		setProfileAudio((prev) => ({ ...prev, atmosphere }));
	}, []);
	const setProfileAudioFeedback = useCallback((feedback: boolean) => {
		setProfileAudio((prev) => ({ ...prev, feedback }));
	}, []);
	const [smoothScroll, setSmoothScroll] = useState(() =>
		readSmoothScrollPref(profile.preferences ?? null),
	);
	const [castCrewMonochromeOnHover, setCastCrewMonochromeOnHover] = useState(
		() => readCastCrewMonochromeOnHoverPref(profile.preferences ?? null),
	);
	const [
		profilePortraitGrayscaleUntilHover,
		setProfilePortraitGrayscaleUntilHover,
	] = useState(() =>
		readProfilePortraitGrayscaleUntilHoverPref(profile.preferences ?? null),
	);
	const [catalogMonochromePeersOnHover, setCatalogMonochromePeersOnHover] =
		useState(() =>
			readCatalogMonochromePeersOnHoverPref(profile.preferences ?? null),
		);
	const [catalogTmdbWatchRegion, setCatalogTmdbWatchRegion] = useState(() => {
		const p = readCatalogTmdbWatchRegionPref(profile.preferences ?? null);
		if (p === null) return "";
		return p === "ALL" ? "ALL" : p;
	});
	const [catalogTmdbLanguage, setCatalogTmdbLanguage] = useState(
		() => readCatalogTmdbLanguagePref(profile.preferences ?? null) ?? "",
	);
	const [reviewTranslationLanguage, setReviewTranslationLanguage] = useState(
		() => readReviewTranslationLanguagePref(profile.preferences ?? null) ?? "",
	);
	const [watchlistStreamingAlerts, setWatchlistStreamingAlerts] = useState(() =>
		readWatchlistStreamingAlertsPref(profile.preferences ?? null),
	);
	const [showAdultContent, setShowAdultContent] = useState(() =>
		readShowAdultContentPref(profile.preferences ?? null),
	);
	const [appTheme, setAppTheme] = useState<AppThemeClass>(() =>
		resolveAppThemeForPatron(
			readAppThemePref(profile.preferences ?? null),
			isPro,
		),
	);
	const [profileAccent, setProfileAccent] = useState<ProfileAccentId | null>(
		() => initialProfileAccent(profile),
	);
	const [bannerFrame, setBannerFrame] = useState<ProfileBannerFrameId>(() =>
		readProfileBannerFramePref(profile.preferences ?? null),
	);
	const [notificationPrefs, setNotificationPrefs] = useState(() =>
		readNotificationPrefsFromProfile(profile.preferences ?? null),
	);
	const [saving, setSaving] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const didHydrateSettingsDraftRef = useRef(false);
	// Last successful save in this session — dirty must not keep comparing
	// against the stale RSC `profile` until `router.refresh()` lands.
	const [committed, setCommitted] = useState<SettingsFormDirtySnapshot | null>(
		null,
	);

	useLayoutEffect(() => {
		if (didHydrateSettingsDraftRef.current) return;
		didHydrateSettingsDraftRef.current = true;
		const stored = readStoredSettingsDraft();
		if (!stored) return;
		setDisplayName(stored.displayName ?? profile.displayName ?? "");
		setBio(stored.bio ?? profile.bio ?? "");
		setPronouns(stored.pronouns ?? profile.pronouns ?? "");
		setLocation(stored.location ?? profile.location ?? "");
		setWebsite(stored.website ?? profile.website ?? "");
		setBirthDate(
			normalizeProfileBirthDateYmd(stored.birthDate) ??
				normalizeProfileBirthDateYmd(profile.birthDate) ??
				"",
		);
		setShowBirthDateOnProfile(
			typeof stored.showBirthDateOnProfile === "boolean"
				? stored.showBirthDateOnProfile
				: readShowBirthDateOnProfilePref(profile.preferences ?? null),
		);
		setPresenceVisibility(
			stored.presenceVisibility === "public"
				? "public"
				: stored.presenceVisibility === "friends"
					? "friends"
					: readProfilePresenceVisibilityPref(profile.preferences ?? null),
		);
		setIsPrivate(
			typeof stored.isPrivate === "boolean"
				? stored.isPrivate
				: Boolean(profile.isPrivate),
		);
		if (typeof stored.senseAudioEnabled === "boolean") {
			setProfileAudio((prev) => ({
				...prev,
				enabled: stored.senseAudioEnabled === true,
				atmosphere:
					stored.senseAudioAtmosphere !== false &&
					stored.senseAudioEnabled === true,
				feedback:
					stored.senseAudioFeedback !== false &&
					stored.senseAudioEnabled === true,
			}));
		} else if (typeof stored.theaterAudio === "boolean") {
			const legacyOn = stored.theaterAudio === true;
			setProfileAudio((prev) => ({
				...prev,
				enabled: legacyOn,
				atmosphere: legacyOn,
				feedback: legacyOn,
			}));
		}
		setSmoothScroll(
			typeof stored.smoothScroll === "boolean"
				? stored.smoothScroll
				: readSmoothScrollPref(profile.preferences ?? null),
		);
		setCastCrewMonochromeOnHover(
			typeof stored.castCrewMonochromeOnHover === "boolean"
				? stored.castCrewMonochromeOnHover
				: readCastCrewMonochromeOnHoverPref(profile.preferences ?? null),
		);
		setProfilePortraitGrayscaleUntilHover(
			typeof stored.profilePortraitGrayscaleUntilHover === "boolean"
				? stored.profilePortraitGrayscaleUntilHover
				: readProfilePortraitGrayscaleUntilHoverPref(
						profile.preferences ?? null,
					),
		);
		setCatalogMonochromePeersOnHover(
			typeof stored.catalogMonochromePeersOnHover === "boolean"
				? stored.catalogMonochromePeersOnHover
				: readCatalogMonochromePeersOnHoverPref(profile.preferences ?? null),
		);
		setCatalogTmdbWatchRegion(
			typeof stored.catalogTmdbWatchRegion === "string"
				? stored.catalogTmdbWatchRegion
				: (() => {
						const p = readCatalogTmdbWatchRegionPref(
							profile.preferences ?? null,
						);
						if (p === null) return "";
						return p === "ALL" ? "ALL" : p;
					})(),
		);
		setCatalogTmdbLanguage(
			typeof stored.catalogTmdbLanguage === "string"
				? stored.catalogTmdbLanguage
				: (readCatalogTmdbLanguagePref(profile.preferences ?? null) ?? ""),
		);
		setReviewTranslationLanguage(
			typeof stored.reviewTranslationLanguage === "string"
				? stored.reviewTranslationLanguage
				: (readReviewTranslationLanguagePref(profile.preferences ?? null) ??
						""),
		);
		setWatchlistStreamingAlerts(
			typeof stored.watchlistStreamingAlerts === "boolean"
				? stored.watchlistStreamingAlerts
				: readWatchlistStreamingAlertsPref(profile.preferences ?? null),
		);
		if (typeof stored.showAdultContent === "boolean") {
			setShowAdultContent(stored.showAdultContent);
		}
		if (stored.appTheme) {
			setAppTheme(readAppThemePref({ appTheme: stored.appTheme }));
		}
	}, [profile]);

	const fromProfile = useMemo(
		() => snapshotSettingsFormFromProfile(profile, isPro),
		[profile, isPro],
	);
	const currentSnapshot = useMemo((): SettingsFormDirtySnapshot => {
		const region = catalogTmdbWatchRegion.trim();
		return {
			displayName: displayName.trim(),
			bio: bio.trim(),
			pronouns: pronouns.trim(),
			location: location.trim(),
			website: website.trim(),
			birthDate,
			showBirthDateOnProfile,
			presenceVisibility,
			discordActivityEnabled,
			isPrivate,
			audioEnabled: profileAudio.enabled,
			audioAtmosphere: profileAudio.atmosphere,
			audioFeedback: profileAudio.feedback,
			smoothScroll,
			castCrewMonochromeOnHover,
			profilePortraitGrayscaleUntilHover,
			catalogMonochromePeersOnHover,
			showAdultContent,
			catalogTmdbWatchRegion: region,
			catalogTmdbLanguage: catalogTmdbLanguage.trim(),
			reviewTranslationLanguage: reviewTranslationLanguage.trim(),
			watchlistStreamingAlerts,
			appTheme,
			profileAccent,
			bannerFrame,
			notificationPrefs,
		};
	}, [
		notificationPrefs,
		displayName,
		bio,
		pronouns,
		location,
		website,
		birthDate,
		showBirthDateOnProfile,
		presenceVisibility,
		discordActivityEnabled,
		isPrivate,
		profileAudio,
		smoothScroll,
		castCrewMonochromeOnHover,
		profilePortraitGrayscaleUntilHover,
		catalogMonochromePeersOnHover,
		showAdultContent,
		catalogTmdbWatchRegion,
		catalogTmdbLanguage,
		reviewTranslationLanguage,
		watchlistStreamingAlerts,
		appTheme,
		profileAccent,
		bannerFrame,
	]);
	const baseline = committed ?? fromProfile;
	const dirty = settingsFormIsDirty(
		currentSnapshot,
		baseline,
		Boolean(pendingBanner || pendingAvatar),
	);

	useEffect(() => {
		// RSC refresh caught up — drop the session override.
		if (committed && settingsFormSnapshotsEqual(fromProfile, committed)) {
			setCommitted(null);
		}
	}, [committed, fromProfile]);

	const resetToProfile = useCallback(() => {
		clearStoredSettingsDraft();
		revokeAllCustomizationPending();
		syncCustomizationDirty(false);
		syncSettingsDirty(false);
		const next = committed ?? fromProfile;
		setDisplayName(next.displayName);
		setBio(next.bio);
		setPronouns(next.pronouns);
		setLocation(next.location);
		setWebsite(next.website);
		setBirthDate(next.birthDate);
		setShowBirthDateOnProfile(next.showBirthDateOnProfile);
		setPresenceVisibility(next.presenceVisibility);
		setDiscordActivityEnabled(next.discordActivityEnabled);
		setIsPrivate(next.isPrivate);
		setProfileAudio((prev) => ({
			...prev,
			enabled: next.audioEnabled,
			atmosphere: next.audioAtmosphere,
			feedback: next.audioFeedback,
		}));
		setSmoothScroll(next.smoothScroll);
		setCastCrewMonochromeOnHover(next.castCrewMonochromeOnHover);
		setProfilePortraitGrayscaleUntilHover(
			next.profilePortraitGrayscaleUntilHover,
		);
		setCatalogMonochromePeersOnHover(next.catalogMonochromePeersOnHover);
		setCatalogTmdbWatchRegion(next.catalogTmdbWatchRegion);
		setCatalogTmdbLanguage(next.catalogTmdbLanguage);
		setReviewTranslationLanguage(next.reviewTranslationLanguage);
		setWatchlistStreamingAlerts(next.watchlistStreamingAlerts);
		setShowAdultContent(next.showAdultContent);
		setAppTheme(next.appTheme);
		setProfileAccent(next.profileAccent);
		setBannerFrame(next.bannerFrame);
		setNotificationPrefs(next.notificationPrefs);
	}, [
		committed,
		fromProfile,
		syncSettingsDirty,
		syncCustomizationDirty,
		revokeAllCustomizationPending,
	]);

	const setNotificationPref = useCallback(
		(kind: NotificationKind, enabled: boolean) => {
			setNotificationPrefs((prev) => ({ ...prev, [kind]: enabled }));
		},
		[],
	);

	useEffect(() => {
		syncSettingsDirty(dirty);
	}, [dirty, syncSettingsDirty]);

	useEffect(() => {
		if (!dirty) {
			clearStoredSettingsDraft();
			return;
		}
		const timeoutId = window.setTimeout(() => {
			writeStoredSettingsDraft({
				displayName,
				bio,
				pronouns,
				location,
				website,
				birthDate,
				showBirthDateOnProfile,
				presenceVisibility,
				isPrivate,
				senseAudioEnabled: profileAudio.enabled,
				senseAudioAtmosphere: profileAudio.atmosphere,
				senseAudioFeedback: profileAudio.feedback,
				theaterAudio: profileAudio.enabled,
				smoothScroll,
				castCrewMonochromeOnHover,
				profilePortraitGrayscaleUntilHover,
				catalogMonochromePeersOnHover,
				catalogTmdbWatchRegion,
				catalogTmdbLanguage,
				reviewTranslationLanguage,
				watchlistStreamingAlerts,
				showAdultContent,
				appTheme,
			});
		}, 280);
		return () => {
			window.clearTimeout(timeoutId);
			writeStoredSettingsDraft({
				displayName,
				bio,
				pronouns,
				location,
				website,
				birthDate,
				showBirthDateOnProfile,
				presenceVisibility,
				isPrivate,
				senseAudioEnabled: profileAudio.enabled,
				senseAudioAtmosphere: profileAudio.atmosphere,
				senseAudioFeedback: profileAudio.feedback,
				theaterAudio: profileAudio.enabled,
				smoothScroll,
				castCrewMonochromeOnHover,
				profilePortraitGrayscaleUntilHover,
				catalogMonochromePeersOnHover,
				catalogTmdbWatchRegion,
				catalogTmdbLanguage,
				reviewTranslationLanguage,
				watchlistStreamingAlerts,
				showAdultContent,
				appTheme,
			});
		};
	}, [
		dirty,
		displayName,
		bio,
		pronouns,
		location,
		website,
		birthDate,
		showBirthDateOnProfile,
		presenceVisibility,
		discordActivityEnabled,
		isPrivate,
		profileAudio,
		smoothScroll,
		castCrewMonochromeOnHover,
		profilePortraitGrayscaleUntilHover,
		catalogMonochromePeersOnHover,
		catalogTmdbWatchRegion,
		catalogTmdbLanguage,
		reviewTranslationLanguage,
		watchlistStreamingAlerts,
		showAdultContent,
		appTheme,
	]);

	const persistShowAdultContent = useCallback(
		async (enabled: boolean) => {
			setSaving(true);
			try {
				await api.api.profiles.me.patch({
					preferences: {
						...(profile.preferences ?? {}),
						[PROFILE_PREF_SHOW_ADULT_CONTENT]: enabled,
					},
				});
				setShowAdultContent(enabled);
				toast.success(
					enabled ? "Adult content enabled" : "Adult content hidden",
				);
				router.refresh();
			} catch (err) {
				console.error(err);
				toast.error("Couldn't update adult content setting");
			} finally {
				setSaving(false);
			}
		},
		[profile.preferences, router],
	);

	const enableAdultContentWithBirthDate = useCallback(
		async (birthDateIso: string) => {
			if (!patronMeetsAdultAgeGate(birthDateIso)) {
				toast.error("You must be at least 18 years old");
				return;
			}
			setSaving(true);
			try {
				await api.api.profiles.me.patch({
					birthDate: birthDateIso,
					preferences: {
						...(profile.preferences ?? {}),
						[PROFILE_PREF_SHOW_ADULT_CONTENT]: true,
					},
				});
				setBirthDate(birthDateIso);
				setShowAdultContent(true);
				toast.success("Adult content enabled");
				router.refresh();
			} catch (err) {
				console.error(err);
				toast.error("Couldn't enable adult content");
			} finally {
				setSaving(false);
			}
		},
		[profile.preferences, router],
	);

	const onSubmit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			if (birthDate && !patronMeetsAdultAgeGate(birthDate)) {
				toast.error(
					"You must be at least 18 years old to save that date of birth",
				);
				return;
			}
			setSaving(true);
			try {
				let prefs: Record<string, unknown> = {
					...(profile.preferences ?? {}),
					[PROFILE_PREF_SMOOTH_SCROLL]: smoothScroll,
					[PROFILE_PREF_CAST_CREW_MONOCHROME_ON_HOVER]:
						castCrewMonochromeOnHover,
					[PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER]:
						profilePortraitGrayscaleUntilHover,
					[PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER]:
						catalogMonochromePeersOnHover,
					[PROFILE_PREF_SHOW_ADULT_CONTENT]: showAdultContent,
					[PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE]: showBirthDateOnProfile,
					[PROFILE_PREF_WATCHLIST_STREAMING_ALERTS]: watchlistStreamingAlerts,
					...(catalogTmdbWatchRegion.trim() !== ""
						? {
								[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION]:
									catalogTmdbWatchRegion,
							}
						: {}),
				};
				const nextPrivacy =
					prefs.privacy && typeof prefs.privacy === "object"
						? { ...(prefs.privacy as Record<string, unknown>) }
						: {};
				nextPrivacy[PROFILE_PREF_PRIVACY_PRESENCE_VISIBILITY] =
					presenceVisibility;
				prefs.privacy = nextPrivacy;
				if (catalogTmdbLanguage.trim() !== "") {
					prefs[PROFILE_PREF_CATALOG_TMDB_LANGUAGE] =
						catalogTmdbLanguage.trim();
				} else {
					delete prefs[PROFILE_PREF_CATALOG_TMDB_LANGUAGE];
				}
				// Empty means “follow the browser”, which is the absence of a stored tag.
				if (reviewTranslationLanguage.trim() !== "") {
					prefs[PROFILE_PREF_REVIEW_TRANSLATION_LANGUAGE] =
						reviewTranslationLanguage.trim();
				} else {
					delete prefs[PROFILE_PREF_REVIEW_TRANSLATION_LANGUAGE];
				}
				prefs[PROFILE_PREF_APP_THEME] = appTheme;
				if (isPro) {
					prefs[PROFILE_PREF_BANNER_FRAME] = bannerFrame;
					const accentToSave =
						profileAccent ??
						(bannerFrame !== "none"
							? (inferProfileAccentFromHex(profile.accentColor) ?? "desert")
							: null);
					if (accentToSave) {
						prefs[PROFILE_PREF_PROFILE_ACCENT] = accentToSave;
					} else {
						delete prefs[PROFILE_PREF_PROFILE_ACCENT];
					}
				} else {
					delete prefs[PROFILE_PREF_PROFILE_ACCENT];
					delete prefs[PROFILE_PREF_BANNER_FRAME];
				}
				prefs.notifications = buildNotificationPrefsPatch(notificationPrefs);
				delete prefs.cinemaPreset;
				delete prefs.cinemaPresetUserOverride;

				prefs = mergeProfileAudioPreferences(prefs, {
					enabled: profileAudio.enabled,
					atmosphere: profileAudio.atmosphere,
					feedback: profileAudio.feedback,
					streakMilestonesCelebrated: readProfileAudioPreferences(
						profile.preferences ?? null,
					).streakMilestonesCelebrated,
				});
				prefs = mergeDiscordActivityEnabledPref(prefs, discordActivityEnabled);

				// Only send birthDate when the user actually changed it — otherwise an
				// unrelated save (e.g. setting an avatar) would clear/re-send the DOB
				// and trip the age-gate validation.
				const birthDateChanged =
					birthDate !== (normalizeProfileBirthDateYmd(profile.birthDate) ?? "");
				const saveRes = await api.api.profiles.me.patch({
					displayName: displayName.trim(),
					bio: bio.trim() || undefined,
					pronouns: pronouns.trim() || undefined,
					location: location.trim() || undefined,
					website: website.trim() || undefined,
					...(birthDateChanged
						? { birthDate: birthDate.trim() === "" ? null : birthDate.trim() }
						: {}),
					isPrivate,
					defaultVisibility:
						(profile.defaultVisibility as ContentVisibility) ?? "public",
					preferences: prefs,
				});
				if (saveRes.error) {
					if (isEmailVerificationRequiredError(saveRes.error.value)) {
						toast.error(EMAIL_VERIFICATION_TOAST);
					} else {
						toast.error("Couldn't save");
					}
					return;
				}
				setAudioPreferences({
					enabled: profileAudio.enabled,
					atmosphere: profileAudio.atmosphere,
					feedback: profileAudio.feedback,
					streakMilestonesCelebrated: readProfileAudioPreferences(
						profile.preferences ?? null,
					).streakMilestonesCelebrated,
				});
				setSmoothScrollEnabled(smoothScroll);
				const hadPendingMedia = Boolean(pendingBanner || pendingAvatar);
				if (pendingBanner) {
					await uploadProfileMeAsset(
						"/api/profiles/me/banner",
						pendingBanner.file,
					);
					setPendingBanner(null);
				}
				if (pendingAvatar) {
					await uploadProfileMeAsset(
						"/api/profiles/me/avatar",
						pendingAvatar.file,
					);
					setPendingAvatar(null);
					void authClient.getSession();
				}
				if (hadPendingMedia) {
					syncCustomizationDirty(false);
				}
				// Adopt the just-saved form as clean immediately — `profile` from
				// the settings layout stays stale until refresh finishes.
				setCommitted(currentSnapshot);
				router.refresh();
				toast.success("Saved");
				invalidateCastCrewMonochromePrefCache(castCrewMonochromeOnHover);
				invalidateCatalogTmdbLanguageCache();
				invalidateReviewTranslationLanguageCache();
				clearSearchDialogGenreCache();
				clearStoredSettingsDraft();
				syncSettingsDirty(false);
			} catch (err) {
				console.error(err);
				toast.error("Couldn't save");
			} finally {
				setSaving(false);
			}
		},
		[
			profile,
			profileAudio,
			smoothScroll,
			castCrewMonochromeOnHover,
			profilePortraitGrayscaleUntilHover,
			catalogMonochromePeersOnHover,
			showAdultContent,
			birthDate,
			showBirthDateOnProfile,
			presenceVisibility,
			discordActivityEnabled,
			catalogTmdbWatchRegion,
			catalogTmdbLanguage,
			reviewTranslationLanguage,
			watchlistStreamingAlerts,
			appTheme,
			isPro,
			bannerFrame,
			profileAccent,
			notificationPrefs,
			displayName,
			bio,
			pronouns,
			location,
			website,
			isPrivate,
			setAudioPreferences,
			setSmoothScrollEnabled,
			pendingBanner,
			pendingAvatar,
			setPendingBanner,
			setPendingAvatar,
			syncCustomizationDirty,
			router,
			syncSettingsDirty,
			currentSnapshot,
		],
	);

	useRegisterMeAccountBarActions(
		useMemo(
			() => ({
				onSave: () => {
					formRef.current?.requestSubmit();
				},
				onCancel: resetToProfile,
				canSave: dirty,
				saving,
			}),
			[dirty, saving, resetToProfile],
		),
	);

	const value = useMemo(
		(): SettingsFormContextValue => ({
			profile,
			isPro,
			effectiveTier,
			featureGrants,
			hasFeature,
			formRef,
			displayName,
			setDisplayName,
			bio,
			setBio,
			pronouns,
			setPronouns,
			location,
			setLocation,
			website,
			setWebsite,
			birthDate,
			setBirthDate,
			showBirthDateOnProfile,
			setShowBirthDateOnProfile,
			presenceVisibility,
			setPresenceVisibility,
			discordActivityEnabled,
			setDiscordActivityEnabled,
			isPrivate,
			setIsPrivate,
			profileAudioEnabled: profileAudio.enabled,
			setProfileAudioEnabled,
			profileAudioAtmosphere: profileAudio.atmosphere,
			setProfileAudioAtmosphere,
			profileAudioFeedback: profileAudio.feedback,
			setProfileAudioFeedback,
			smoothScroll,
			setSmoothScroll,
			castCrewMonochromeOnHover,
			setCastCrewMonochromeOnHover,
			profilePortraitGrayscaleUntilHover,
			setProfilePortraitGrayscaleUntilHover,
			catalogMonochromePeersOnHover,
			setCatalogMonochromePeersOnHover,
			catalogTmdbWatchRegion,
			setCatalogTmdbWatchRegion,
			catalogTmdbLanguage,
			setCatalogTmdbLanguage,
			reviewTranslationLanguage,
			setReviewTranslationLanguage,
			watchlistStreamingAlerts,
			setWatchlistStreamingAlerts,
			showAdultContent,
			setShowAdultContent,
			enableAdultContentWithBirthDate,
			persistShowAdultContent,
			appTheme,
			setAppTheme,
			profileAccent,
			setProfileAccent,
			bannerFrame,
			setBannerFrame,
			notificationPrefs,
			setNotificationPref,
			saving,
			onSubmit,
			resetToProfile,
		}),
		[
			profile,
			isPro,
			effectiveTier,
			featureGrants,
			hasFeature,
			displayName,
			bio,
			pronouns,
			location,
			website,
			birthDate,
			showBirthDateOnProfile,
			presenceVisibility,
			discordActivityEnabled,
			isPrivate,
			profileAudio,
			smoothScroll,
			castCrewMonochromeOnHover,
			profilePortraitGrayscaleUntilHover,
			catalogMonochromePeersOnHover,
			showAdultContent,
			enableAdultContentWithBirthDate,
			persistShowAdultContent,
			catalogTmdbWatchRegion,
			catalogTmdbLanguage,
			reviewTranslationLanguage,
			watchlistStreamingAlerts,
			appTheme,
			profileAccent,
			bannerFrame,
			notificationPrefs,
			setNotificationPref,
			saving,
			onSubmit,
			resetToProfile,
			setProfileAudioEnabled,
			setProfileAudioAtmosphere,
			setProfileAudioFeedback,
		],
	);

	return (
		<SettingsFormContext.Provider value={value}>
			{children}
		</SettingsFormContext.Provider>
	);
}

export function useSettingsForm(): SettingsFormContextValue {
	const ctx = useContext(SettingsFormContext);
	if (!ctx) {
		throw new Error("useSettingsForm must be used under SettingsFormProvider");
	}
	return ctx;
}
