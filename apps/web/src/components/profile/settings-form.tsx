"use client";

import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { useRegisterMeAccountBarActions } from "@/components/profile/me-account-bar-actions-context";
import {
	MeAccountContentReveal,
	MeAccountRevealItem,
} from "@/components/profile/me-account-content-reveal";
import {
	clearStoredSettingsDraft,
	readStoredSettingsDraft,
	useMeAccountSession,
	writeStoredSettingsDraft,
} from "@/components/profile/me-account-session-context";
import { MeAnilistImport } from "@/components/profile/me-anilist-import";
import { MeAppearanceSettings } from "@/components/profile/me-appearance-settings";
import { MeCatalogLanguageSelect } from "@/components/profile/me-catalog-language-select";
import { MeCatalogWatchRegionSelect } from "@/components/profile/me-catalog-watch-region-select";
import {
	MeFormField,
	meFieldControlClass,
} from "@/components/profile/me-form-field";
import { MeLetterboxdImport } from "@/components/profile/me-letterboxd-import";
import { MePreferenceToggle } from "@/components/profile/me-preference-toggle";
import { MeProfileVisibilityToggle } from "@/components/profile/me-profile-visibility-toggle";
import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";
import {
	type ContentVisibility,
	VisibilitySelect,
} from "@/components/review/visibility-select";
import { api } from "@/lib/api";
import { type AppThemeClass, resolveAppThemeForPatron } from "@/lib/app-themes";
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
	readAppThemePref,
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbLanguagePref,
	readCatalogTmdbWatchRegionPref,
	resolveCatalogTmdbLanguage,
} from "@/lib/profile-preferences";
import { uploadProfileMeAsset } from "@/lib/upload-profile-me-asset";
import { invalidateCatalogTmdbLanguageCache } from "@/lib/use-catalog-tmdb-language";
import { clearSearchDialogGenreCache } from "@/lib/use-search-dialog-genres";

type MeProfile = {
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

function initialProfileAccent(profile: MeProfile): ProfileAccentId | null {
	return (
		readProfileAccentPref(profile.preferences ?? null) ??
		inferProfileAccentFromHex(profile.accentColor)
	);
}

export function SettingsForm({ profile }: { profile: MeProfile }) {
	const isPro = Boolean(profile.isPro);
	const { setTheaterAudioEnabled } = useCinematicAudio();
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
	const [defaultVisibility, setDefaultVisibility] = useState<ContentVisibility>(
		(profile.defaultVisibility as ContentVisibility) ?? "public",
	);
	const [theaterAudio, setTheaterAudio] = useState(
		Boolean(profile.preferences?.theaterAudio === true),
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

	// After mount, merge any `sessionStorage` draft so `/me/settings` ↔ `/me/customize` keeps
	// in-progress text (each visit gets a fresh mount, so this runs once per entry).
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
			defaultVisibility !==
				((profile.defaultVisibility as ContentVisibility) ?? "public") ||
			theaterAudio !== Boolean(profile.preferences?.theaterAudio === true) ||
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
		defaultVisibility,
		theaterAudio,
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
		setDefaultVisibility(
			(profile.defaultVisibility as ContentVisibility) ?? "public",
		);
		setTheaterAudio(Boolean(profile.preferences?.theaterAudio === true));
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
	}, [profile, syncSettingsDirty]);

	function setNotificationPref(kind: NotificationKind, enabled: boolean) {
		setNotificationPrefs((prev) => ({ ...prev, [kind]: enabled }));
	}

	// Drive `/me` leave guards + `beforeunload` from the latest dirty snapshot (survives unmount).
	useEffect(() => {
		syncSettingsDirty(dirty);
	}, [dirty, syncSettingsDirty]);

	// Persist text drafts only while dirty so a clean form does not leave stale `sessionStorage`.
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
				catalogMonochromePeersOnHover,
				catalogTmdbWatchRegion,
				catalogTmdbLanguage,
				appTheme,
			});
		}, 280);
		return () => {
			window.clearTimeout(timeoutId);
			// Flush immediately on dependency changes / unmount so a quick tab switch does not
			// miss the last debounced write window.
			writeStoredSettingsDraft({
				displayName,
				bio,
				pronouns,
				location,
				website,
				isPrivate,
				theaterAudio,
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
		catalogMonochromePeersOnHover,
		catalogTmdbWatchRegion,
		catalogTmdbLanguage,
		appTheme,
	]);

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

	async function submit(e: FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			const prefs: Record<string, unknown> = {
				...(profile.preferences ?? {}),
				theaterAudio,
				[PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER]:
					catalogMonochromePeersOnHover,
				...(catalogTmdbWatchRegion.trim() !== ""
					? {
							[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION]: catalogTmdbWatchRegion,
						}
					: {}),
			};
			if (catalogTmdbLanguage.trim() !== "") {
				prefs[PROFILE_PREF_CATALOG_TMDB_LANGUAGE] = catalogTmdbLanguage.trim();
			} else {
				delete prefs[PROFILE_PREF_CATALOG_TMDB_LANGUAGE];
			}
			prefs[PROFILE_PREF_APP_THEME] = appTheme;
			if (isPro) {
				// Banner frame saves independently — accent is optional but we mirror a preset
				// when a frame is chosen so PATCH can update public `accentColor`.
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
				defaultVisibility,
				preferences: prefs,
			});
			setTheaterAudioEnabled(theaterAudio);
			// Staged banner/avatar from Customize survive route changes — flush them here so one
			// Save from Settings can ship profile text + pending media together.
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
			}
			if (hadPendingMedia) {
				syncCustomizationDirty(false);
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
	}

	return (
		<form ref={formRef} onSubmit={submit}>
			<MeAccountContentReveal className="space-y-0">
				<MeAccountRevealItem>
					<div className="flex flex-col gap-12 pb-4 lg:gap-14">
						<MeSettingsSection
							title="Profile"
							description="Public identity and links on your page."
						>
							<MeSettingsPanel className="flex flex-col">
								<div className="grid min-w-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] xl:items-start xl:gap-8">
									<div className="space-y-4">
										<MeFormField id="displayName" label="Name">
											<Input
												id="displayName"
												value={displayName}
												onChange={(e) => setDisplayName(e.target.value)}
												required
												maxLength={120}
												className={meFieldControlClass()}
											/>
										</MeFormField>
										<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
											<MeFormField id="pronouns" label="Pronouns">
												<Input
													id="pronouns"
													value={pronouns}
													onChange={(e) => setPronouns(e.target.value)}
													maxLength={40}
													className={meFieldControlClass()}
												/>
											</MeFormField>
											<MeFormField id="location" label="Location">
												<Input
													id="location"
													value={location}
													onChange={(e) => setLocation(e.target.value)}
													maxLength={80}
													className={meFieldControlClass()}
												/>
											</MeFormField>
										</div>
										<MeFormField id="website" label="Website">
											<Input
												id="website"
												type="url"
												value={website}
												onChange={(e) => setWebsite(e.target.value)}
												placeholder="https://"
												className={meFieldControlClass()}
											/>
										</MeFormField>
									</div>
									<MeFormField id="bio" label="Bio" className="xl:pt-0">
										<Textarea
											id="bio"
											rows={6}
											value={bio}
											onChange={(e) => setBio(e.target.value)}
											maxLength={600}
											className={meFieldControlClass(
												"min-h-44 resize-y py-3 xl:min-h-58",
											)}
										/>
									</MeFormField>
								</div>
								<div className="space-y-5 pt-5">
									<MeFormField
										id="defaultVisibility"
										label="Default visibility for new posts"
										hint="Applied to new diary logs and reviews when you don't choose a specific audience."
									>
										<VisibilitySelect
											id="defaultVisibility"
											value={defaultVisibility}
											onChange={setDefaultVisibility}
											popoverSide="bottom"
										/>
									</MeFormField>
									<div className="flex justify-end">
										<MeProfileVisibilityToggle
											checked={isPrivate}
											onChange={setIsPrivate}
										/>
									</div>
								</div>
							</MeSettingsPanel>
						</MeSettingsSection>

						<MeSettingsSection
							title="Notifications"
							description="High-signal inbox only — tune what reaches your bell."
						>
							<MeSettingsPanel className="space-y-6">
								{NOTIFICATION_KIND_SETTINGS.map((entry) => (
									<MePreferenceToggle
										key={entry.id}
										id={`notification-${entry.id}`}
										checked={notificationPrefs[entry.id]}
										onChange={(checked) =>
											setNotificationPref(entry.id, checked)
										}
										title={entry.label}
										description={entry.description}
									/>
								))}
							</MeSettingsPanel>
						</MeSettingsSection>

						<MeSettingsSection
							title="Catalogue"
							description="Defaults for home, discover, and streaming."
						>
							<MeSettingsPanel className="space-y-5">
								<MeFormField
									id="catalogTmdbWatchRegion"
									label="Watch region (TMDb)"
									hint="“At home” lists use this region. “In cinemas” uses the same country for release dates when you pick a code (not “All countries”). Leave unset to choose on first visit."
								>
									<MeCatalogWatchRegionSelect
										id="catalogTmdbWatchRegion"
										value={catalogTmdbWatchRegion}
										onChange={setCatalogTmdbWatchRegion}
									/>
								</MeFormField>
								<MeFormField
									id="catalogTmdbLanguage"
									label="Catalogue language"
									hint={`Titles, genres, and search tags use this language. Default follows watch region (${resolveCatalogTmdbLanguage(profile.preferences ?? null)}).`}
								>
									<MeCatalogLanguageSelect
										id="catalogTmdbLanguage"
										value={catalogTmdbLanguage}
										onChange={setCatalogTmdbLanguage}
									/>
								</MeFormField>
								<MePreferenceToggle
									id="catalog-monochrome-hover"
									checked={catalogMonochromePeersOnHover}
									onChange={setCatalogMonochromePeersOnHover}
									title="Monochrome neighbors on hover"
									description="On the home catalogue, posters you are not pointing at turn grayscale while one title is hovered. Turn off to keep every tile in full color."
								/>
							</MeSettingsPanel>
						</MeSettingsSection>

						<MeSettingsSection
							title="Appearance"
							description="App palette plus Pro profile expression on your public page."
						>
							<MeSettingsPanel>
								<MeAppearanceSettings
									isPro={isPro}
									appTheme={appTheme}
									onAppThemeChange={setAppTheme}
									profileAccent={profileAccent}
									bannerFrame={bannerFrame}
									onProfileAccentChange={setProfileAccent}
									onBannerFrameChange={(next) => {
										setBannerFrame(next);
										// Picking a frame without an accent used to block save entirely.
										if (isPro && next !== "none" && profileAccent == null) {
											setProfileAccent(
												inferProfileAccentFromHex(profile.accentColor) ??
													"desert",
											);
										}
									}}
								/>
							</MeSettingsPanel>
						</MeSettingsSection>

						<MeLetterboxdImport />

						<MeAnilistImport />

						<MeSettingsSection title="Experience">
							<MeSettingsPanel featured>
								<MePreferenceToggle
									id="theater-audio"
									checked={theaterAudio}
									onChange={setTheaterAudio}
									title="Theater audio (experimental)"
									description="Projector hum on film detail pages plus a reel clack when you finish logging. Mutes automatically with reduced motion. Disabled by default; nothing autoplays without a gesture from you."
								/>
							</MeSettingsPanel>
						</MeSettingsSection>
					</div>
				</MeAccountRevealItem>
			</MeAccountContentReveal>
		</form>
	);
}
