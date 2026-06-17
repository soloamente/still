"use client";

import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import type { ReactNode } from "react";
import { useState } from "react";

import { AdultContentEnableDialog } from "@/components/profile/adult-content-enable-dialog";
import { BirthDatePicker } from "@/components/profile/birth-date-picker";
import {
	MeAccountContentReveal,
	MeAccountRevealItem,
} from "@/components/profile/me-account-content-reveal";
import { MeAnilistImport } from "@/components/profile/me-anilist-import";
import { MeAppearanceSettings } from "@/components/profile/me-appearance-settings";
import { MeCatalogLanguageSelect } from "@/components/profile/me-catalog-language-select";
import { MeCatalogWatchRegionSelect } from "@/components/profile/me-catalog-watch-region-select";
import { MeDangerZone } from "@/components/profile/me-danger-zone";
import { MeDataExportPanel } from "@/components/profile/me-data-export-panel";
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
import { ProfileMediaCustomizer } from "@/components/profile/profile-media-customizer";
import { useSettingsForm } from "@/components/profile/settings-form-context";
import { patronMeetsAdultAgeGate } from "@/lib/adult-content-age-gate";
import { authClient } from "@/lib/auth-client";
import { NOTIFICATION_KIND_SETTINGS } from "@/lib/notification-preferences";
import { inferProfileAccentFromHex } from "@/lib/profile-appearance";
import { resolveCatalogTmdbLanguage } from "@/lib/profile-preferences";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

function SettingsSectionPage({ children }: { children: ReactNode }) {
	return (
		<MeAccountContentReveal className="space-y-0">
			<MeAccountRevealItem>
				<div className="flex flex-col gap-12 pb-4 lg:gap-14">{children}</div>
			</MeAccountRevealItem>
		</MeAccountContentReveal>
	);
}

export function SettingsProfileSection() {
	const {
		profile,
		isPro,
		displayName,
		setDisplayName,
		pronouns,
		setPronouns,
		location,
		setLocation,
		website,
		setWebsite,
		bio,
		setBio,
		birthDate,
		setBirthDate,
		showBirthDateOnProfile,
		setShowBirthDateOnProfile,
		presenceVisibility,
		setPresenceVisibility,
		isPrivate,
		setIsPrivate,
		saving,
	} = useSettingsForm();
	const { data: session } = authClient.useSession();
	const showEmailVerificationNote = session?.user?.emailVerified === false;

	return (
		<SettingsSectionPage>
			<MeSettingsSection
				title="Profile"
				description="Photo, public identity, and links on your page."
			>
				<ProfileMediaCustomizer
					handle={profile.handle}
					bannerUrl={profile.bannerUrl ?? null}
					hasAvatar={Boolean(profile.hasAvatar)}
					isPro={isPro}
					disabled={saving}
				/>
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
							<MeFormField
								id="birthDate"
								label="Date of birth"
								hint="Used for age verification. Year is never shown on your profile."
							>
								<BirthDatePicker
									id="birthDate"
									value={birthDate}
									onChange={setBirthDate}
								/>
							</MeFormField>
							<div
								className={
									birthDate ? undefined : "pointer-events-none opacity-50"
								}
							>
								<MePreferenceToggle
									id="show-birthday-on-profile"
									checked={Boolean(birthDate) && showBirthDateOnProfile}
									onChange={(next) => {
										if (!birthDate) return;
										setShowBirthDateOnProfile(next);
									}}
									title="Show birthday on profile"
									description={
										birthDate
											? "Visitors see month and day only — never your birth year."
											: "Add your date of birth above to show it on your profile."
									}
								/>
							</div>
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
					<div className="flex flex-col items-end gap-2 pt-5">
						{showEmailVerificationNote ? (
							<p className="max-w-md text-pretty text-right text-muted-foreground text-sm">
								Verify your email before making your profile or posts public.
							</p>
						) : null}
						<MeProfileVisibilityToggle
							checked={isPrivate}
							onChange={setIsPrivate}
						/>
						<div className="w-full pt-3">
							<MePreferenceToggle
								id="presence-visibility"
								checked={presenceVisibility === "public"}
								onChange={(next) =>
									setPresenceVisibility(next ? "public" : "friends")
								}
								title="Who can see when I'm online?"
								description="Choose whether your online-now status across Sense is visible to Friends only or everyone."
								onLabel="Public"
								offLabel="Friends only"
							/>
						</div>
					</div>
				</MeSettingsPanel>
			</MeSettingsSection>
		</SettingsSectionPage>
	);
}

export function SettingsNotificationsSection() {
	const { notificationPrefs, setNotificationPref } = useSettingsForm();

	return (
		<SettingsSectionPage>
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
							onChange={(checked) => setNotificationPref(entry.id, checked)}
							title={entry.label}
							description={entry.description}
						/>
					))}
				</MeSettingsPanel>
			</MeSettingsSection>
		</SettingsSectionPage>
	);
}

export function SettingsCatalogueSection() {
	const {
		profile,
		catalogTmdbWatchRegion,
		setCatalogTmdbWatchRegion,
		catalogTmdbLanguage,
		setCatalogTmdbLanguage,
		watchlistStreamingAlerts,
		setWatchlistStreamingAlerts,
		catalogMonochromePeersOnHover,
		setCatalogMonochromePeersOnHover,
		showAdultContent,
		birthDate,
		enableAdultContentWithBirthDate,
		persistShowAdultContent,
	} = useSettingsForm();
	const [adultEnableOpen, setAdultEnableOpen] = useState(false);
	const hasEligibleBirthDate =
		Boolean(birthDate) && patronMeetsAdultAgeGate(birthDate);

	return (
		<SettingsSectionPage>
			<AdultContentEnableDialog
				open={adultEnableOpen}
				onOpenChange={setAdultEnableOpen}
				onConfirm={(nextBirthDate) =>
					void enableAdultContentWithBirthDate(nextBirthDate)
				}
			/>
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
					<MePreferenceToggle
						id="watchlist-streaming-alerts"
						checked={watchlistStreamingAlerts}
						onChange={setWatchlistStreamingAlerts}
						title="Notify when watchlisted titles stream near me"
						description="Uses your watch region above. Sense checks cached streaming data daily and pings your inbox when a saved title lands on a new service."
					/>
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
					<MePreferenceToggle
						id="show-adult-content"
						checked={showAdultContent}
						onChange={(next) => {
							if (!next) {
								void persistShowAdultContent(false);
								return;
							}
							if (birthDate && !patronMeetsAdultAgeGate(birthDate)) {
								return;
							}
							if (hasEligibleBirthDate) {
								void persistShowAdultContent(true);
								return;
							}
							setAdultEnableOpen(true);
						}}
						title="Show adult content"
						description={
							birthDate && !patronMeetsAdultAgeGate(birthDate)
								? "Add a valid date of birth in Profile settings — you must be 18 or older."
								: "Include 18+ films and anime in search, catalogues, and your diary. Off by default."
						}
					/>
				</MeSettingsPanel>
			</MeSettingsSection>
		</SettingsSectionPage>
	);
}

export function SettingsAppearanceSection() {
	const {
		profile,
		isPro,
		appTheme,
		setAppTheme,
		profileAccent,
		setProfileAccent,
		bannerFrame,
		setBannerFrame,
		profilePortraitGrayscaleUntilHover,
		setProfilePortraitGrayscaleUntilHover,
	} = useSettingsForm();

	return (
		<SettingsSectionPage>
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
							if (isPro && next !== "none" && profileAccent == null) {
								setProfileAccent(
									inferProfileAccentFromHex(profile.accentColor) ?? "desert",
								);
							}
						}}
						profilePortraitGrayscaleUntilHover={
							profilePortraitGrayscaleUntilHover
						}
						onProfilePortraitGrayscaleUntilHoverChange={
							setProfilePortraitGrayscaleUntilHover
						}
					/>
				</MeSettingsPanel>
			</MeSettingsSection>
		</SettingsSectionPage>
	);
}

export function SettingsDataSection() {
	return (
		<SettingsSectionPage>
			<MeLetterboxdImport />
			<MeAnilistImport />
			<MeDataExportPanel />
			<MeDangerZone />
		</SettingsSectionPage>
	);
}

export function SettingsExperienceSection() {
	const {
		profileAudioEnabled,
		setProfileAudioEnabled,
		profileAudioAtmosphere,
		setProfileAudioAtmosphere,
		profileAudioFeedback,
		setProfileAudioFeedback,
		smoothScroll,
		setSmoothScroll,
		castCrewMonochromeOnHover,
		setCastCrewMonochromeOnHover,
	} = useSettingsForm();
	const prefersReducedMotion = usePrefersReducedMotion();

	return (
		<SettingsSectionPage>
			<MeSettingsSection
				title="Experience"
				description="Motion and atmosphere — all optional, off by default."
			>
				<MeSettingsPanel featured className="space-y-8">
					<MePreferenceToggle
						id="smooth-scroll"
						checked={smoothScroll}
						onChange={setSmoothScroll}
						title="Smooth scroll"
						description="Gentle wheel inertia across the app (Lenis). Leave off on slower devices — native scroll stays snappy and lighter on the GPU."
					/>
					<MePreferenceToggle
						id="cast-crew-monochrome-hover"
						checked={castCrewMonochromeOnHover}
						onChange={setCastCrewMonochromeOnHover}
						title="Monochrome cast & crew"
						description="On film and TV detail pages, cast and crew headshots stay grayscale until you hover. Off by default — previews show full color."
					/>
					<div className="space-y-6">
						<MePreferenceToggle
							id="sense-audio-enabled"
							checked={profileAudioEnabled}
							onChange={setProfileAudioEnabled}
							title="Sense audio (experimental)"
							description="Optional cinema atmosphere and milestone feedback. Disabled by default; nothing autoplays without a gesture from you."
						/>
						{profileAudioEnabled ? (
							<div className="space-y-6 border-border/60 border-l pl-5">
								<MePreferenceToggle
									id="sense-audio-atmosphere"
									checked={profileAudioAtmosphere}
									onChange={setProfileAudioAtmosphere}
									title="Atmosphere"
									description="Looping projector hum on film and TV detail pages."
								/>
								<MePreferenceToggle
									id="sense-audio-feedback"
									checked={profileAudioFeedback}
									onChange={setProfileAudioFeedback}
									title="Feedback"
									description="Soft reel clack when you log, plus chimes for prestige badges and streak milestones."
								/>
							</div>
						) : null}
						{prefersReducedMotion ? (
							<p className="text-pretty text-muted-foreground text-sm">
								Reduced motion is on — audio cues stay muted until you turn it
								off in system settings.
							</p>
						) : null}
					</div>
				</MeSettingsPanel>
			</MeSettingsSection>
		</SettingsSectionPage>
	);
}
