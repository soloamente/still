"use client";

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
import type { ContentVisibility } from "@/components/review/visibility-select";
import { api } from "@/lib/api";
import { type AppThemeClass, resolveAppThemeForPatron } from "@/lib/app-themes";
import { authClient } from "@/lib/auth-client";
import {
	buildNotificationPrefsPatch,
	NOTIFICATION_KIND_SETTINGS,
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
	PROFILE_PREF_APP_THEME,
	PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER,
	PROFILE_PREF_CATALOG_TMDB_LANGUAGE,
	PROFILE_PREF_CATALOG_TMDB_WATCH_REGION,
	PROFILE_PREF_SMOOTH_SCROLL,
	readAppThemePref,
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbLanguagePref,
	readCatalogTmdbWatchRegionPref,
	readSmoothScrollPref,
} from "@/lib/profile-preferences";
import { uploadProfileMeAsset } from "@/lib/upload-profile-me-asset";
import { invalidateCatalogTmdbLanguageCache } from "@/lib/use-catalog-tmdb-language";
import { clearSearchDialogGenreCache } from "@/lib/use-search-dialog-genres";

export type SettingsProfile = {
	handle: string;
	displayName: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
	isPrivate: boolean;
	isPro?: boolean;
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
	isPrivate: boolean;
	setIsPrivate: (value: boolean) => void;
	theaterAudio: boolean;
	setTheaterAudio: (value: boolean) => void;
	smoothScroll: boolean;
	setSmoothScroll: (value: boolean) => void;
	catalogMonochromePeersOnHover: boolean;
	setCatalogMonochromePeersOnHover: (value: boolean) => void;
	catalogTmdbWatchRegion: string;
	setCatalogTmdbWatchRegion: (value: string) => void;
	catalogTmdbLanguage: string;
	setCatalogTmdbLanguage: (value: string) => void;
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
	const { setTheaterAudioEnabled } = useCinematicAudio();
	const { setSmoothScrollEnabled } = useSmoothScrollPreference();
	const {
		syncSettingsDirty,
		syncCustomizationDirty,
		pendingBanner,
		pendingAvatar,
		setPendingBanner,
		setPendingAvatar,
	} = useMeAccountSession();
	const [displayName, setDisplayName] = useState(profile.displayName ?? "");
	const [bio, setBio] = useState(profile.bio ?? "");
	const [pronouns, setPronouns] = useState(profile.pronouns ?? "");
	const [location, setLocation] = useState(profile.location ?? "");
	const [website, setWebsite] = useState(profile.website ?? "");
	const [isPrivate, setIsPrivate] = useState(Boolean(profile.isPrivate));
	const [theaterAudio, setTheaterAudio] = useState(
		Boolean(profile.preferences?.theaterAudio === true),
	);
	const [smoothScroll, setSmoothScroll] = useState(() =>
		readSmoothScrollPref(profile.preferences ?? null),
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
		setIsPrivate(
			typeof stored.isPrivate === "boolean"
				? stored.isPrivate
				: Boolean(profile.isPrivate),
		);
		setTheaterAudio(
			typeof stored.theaterAudio === "boolean"
				? stored.theaterAudio
				: Boolean(profile.preferences?.theaterAudio === true),
		);
		setSmoothScroll(
			typeof stored.smoothScroll === "boolean"
				? stored.smoothScroll
				: readSmoothScrollPref(profile.preferences ?? null),
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
		if (stored.appTheme) {
			setAppTheme(readAppThemePref({ appTheme: stored.appTheme }));
		}
	}, [profile]);

	const dirty = useMemo(() => {
		const regionFromProfile = readCatalogTmdbWatchRegionPref(
			profile.preferences ?? null,
		);
		const regionStr =
			regionFromProfile === null
				? ""
				: regionFromProfile === "ALL"
					? "ALL"
					: regionFromProfile;
		const languageFromProfile =
			readCatalogTmdbLanguagePref(profile.preferences ?? null) ?? "";
		const themeFromProfile = resolveAppThemeForPatron(
			readAppThemePref(profile.preferences ?? null),
			isPro,
		);
		const accentFromProfile = initialProfileAccent(profile);
		const frameFromProfile = readProfileBannerFramePref(
			profile.preferences ?? null,
		);
		const notificationsFromProfile = readNotificationPrefsFromProfile(
			profile.preferences ?? null,
		);
		const notificationsDirty = NOTIFICATION_KIND_SETTINGS.some(
			(k) => notificationPrefs[k.id] !== notificationsFromProfile[k.id],
		);
		return (
			displayName.trim() !== (profile.displayName ?? "").trim() ||
			bio.trim() !== (profile.bio ?? "").trim() ||
			pronouns.trim() !== (profile.pronouns ?? "").trim() ||
			location.trim() !== (profile.location ?? "").trim() ||
			website.trim() !== (profile.website ?? "").trim() ||
			isPrivate !== Boolean(profile.isPrivate) ||
			theaterAudio !== Boolean(profile.preferences?.theaterAudio === true) ||
			smoothScroll !== readSmoothScrollPref(profile.preferences ?? null) ||
			catalogMonochromePeersOnHover !==
				readCatalogMonochromePeersOnHoverPref(profile.preferences ?? null) ||
			catalogTmdbWatchRegion.trim() !== regionStr ||
			catalogTmdbLanguage.trim() !== languageFromProfile ||
			appTheme !== themeFromProfile ||
			profileAccent !== accentFromProfile ||
			bannerFrame !== frameFromProfile ||
			notificationsDirty
		);
	}, [
		profile,
		notificationPrefs,
		displayName,
		bio,
		pronouns,
		location,
		website,
		isPrivate,
		theaterAudio,
		smoothScroll,
		catalogMonochromePeersOnHover,
		catalogTmdbWatchRegion,
		catalogTmdbLanguage,
		appTheme,
		profileAccent,
		bannerFrame,
		isPro,
	]);

	const resetToProfile = useCallback(() => {
		clearStoredSettingsDraft();
		syncSettingsDirty(false);
		setDisplayName(profile.displayName ?? "");
		setBio(profile.bio ?? "");
		setPronouns(profile.pronouns ?? "");
		setLocation(profile.location ?? "");
		setWebsite(profile.website ?? "");
		setIsPrivate(Boolean(profile.isPrivate));
		setTheaterAudio(Boolean(profile.preferences?.theaterAudio === true));
		setSmoothScroll(readSmoothScrollPref(profile.preferences ?? null));
		setCatalogMonochromePeersOnHover(
			readCatalogMonochromePeersOnHoverPref(profile.preferences ?? null),
		);
		const p = readCatalogTmdbWatchRegionPref(profile.preferences ?? null);
		setCatalogTmdbWatchRegion(p === null ? "" : p === "ALL" ? "ALL" : p);
		setCatalogTmdbLanguage(
			readCatalogTmdbLanguagePref(profile.preferences ?? null) ?? "",
		);
		setAppTheme(
			resolveAppThemeForPatron(
				readAppThemePref(profile.preferences ?? null),
				isPro,
			),
		);
		setProfileAccent(initialProfileAccent(profile));
		setBannerFrame(readProfileBannerFramePref(profile.preferences ?? null));
		setNotificationPrefs(
			readNotificationPrefsFromProfile(profile.preferences ?? null),
		);
	}, [profile, syncSettingsDirty, isPro]);

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
				isPrivate,
				theaterAudio,
				smoothScroll,
				catalogMonochromePeersOnHover,
				catalogTmdbWatchRegion,
				catalogTmdbLanguage,
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
				isPrivate,
				theaterAudio,
				smoothScroll,
				catalogMonochromePeersOnHover,
				catalogTmdbWatchRegion,
				catalogTmdbLanguage,
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
		isPrivate,
		theaterAudio,
		smoothScroll,
		catalogMonochromePeersOnHover,
		catalogTmdbWatchRegion,
		catalogTmdbLanguage,
		appTheme,
	]);

	const onSubmit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			setSaving(true);
			try {
				const prefs: Record<string, unknown> = {
					...(profile.preferences ?? {}),
					theaterAudio,
					[PROFILE_PREF_SMOOTH_SCROLL]: smoothScroll,
					[PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER]:
						catalogMonochromePeersOnHover,
					...(catalogTmdbWatchRegion.trim() !== ""
						? {
								[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION]:
									catalogTmdbWatchRegion,
							}
						: {}),
				};
				if (catalogTmdbLanguage.trim() !== "") {
					prefs[PROFILE_PREF_CATALOG_TMDB_LANGUAGE] =
						catalogTmdbLanguage.trim();
				} else {
					delete prefs[PROFILE_PREF_CATALOG_TMDB_LANGUAGE];
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

				await api.api.profiles.me.patch({
					displayName: displayName.trim(),
					bio: bio.trim() || undefined,
					pronouns: pronouns.trim() || undefined,
					location: location.trim() || undefined,
					website: website.trim() || undefined,
					isPrivate,
					defaultVisibility:
						(profile.defaultVisibility as ContentVisibility) ?? "public",
					preferences: prefs,
				});
				setTheaterAudioEnabled(theaterAudio);
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
					router.refresh();
				}
				toast.success("Saved");
				invalidateCatalogTmdbLanguageCache();
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
			theaterAudio,
			smoothScroll,
			catalogMonochromePeersOnHover,
			catalogTmdbWatchRegion,
			catalogTmdbLanguage,
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
			setTheaterAudioEnabled,
			setSmoothScrollEnabled,
			pendingBanner,
			pendingAvatar,
			setPendingBanner,
			setPendingAvatar,
			syncCustomizationDirty,
			router,
			syncSettingsDirty,
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
			isPrivate,
			setIsPrivate,
			theaterAudio,
			setTheaterAudio,
			smoothScroll,
			setSmoothScroll,
			catalogMonochromePeersOnHover,
			setCatalogMonochromePeersOnHover,
			catalogTmdbWatchRegion,
			setCatalogTmdbWatchRegion,
			catalogTmdbLanguage,
			setCatalogTmdbLanguage,
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
			displayName,
			bio,
			pronouns,
			location,
			website,
			isPrivate,
			theaterAudio,
			smoothScroll,
			catalogMonochromePeersOnHover,
			catalogTmdbWatchRegion,
			catalogTmdbLanguage,
			appTheme,
			profileAccent,
			bannerFrame,
			notificationPrefs,
			setNotificationPref,
			saving,
			onSubmit,
			resetToProfile,
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
