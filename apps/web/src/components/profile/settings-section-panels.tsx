"use client";

import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import type { ReactNode } from "react";

import {
	MeAccountContentReveal,
	MeAccountRevealItem,
} from "@/components/profile/me-account-content-reveal";
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
import { useSettingsForm } from "@/components/profile/settings-form-context";
import { NOTIFICATION_KIND_SETTINGS } from "@/lib/notification-preferences";
import { inferProfileAccentFromHex } from "@/lib/profile-appearance";
import { resolveCatalogTmdbLanguage } from "@/lib/profile-preferences";

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
		isPrivate,
		setIsPrivate,
	} = useSettingsForm();

	return (
		<SettingsSectionPage>
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
					<div className="flex justify-end pt-5">
						<MeProfileVisibilityToggle
							checked={isPrivate}
							onChange={setIsPrivate}
						/>
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
		catalogMonochromePeersOnHover,
		setCatalogMonochromePeersOnHover,
	} = useSettingsForm();

	return (
		<SettingsSectionPage>
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
					/>
				</MeSettingsPanel>
			</MeSettingsSection>
		</SettingsSectionPage>
	);
}

export function SettingsImportsSection() {
	return (
		<SettingsSectionPage>
			<MeLetterboxdImport />
			<MeAnilistImport />
		</SettingsSectionPage>
	);
}

export function SettingsExperienceSection() {
	const { theaterAudio, setTheaterAudio, smoothScroll, setSmoothScroll } =
		useSettingsForm();

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
						id="theater-audio"
						checked={theaterAudio}
						onChange={setTheaterAudio}
						title="Theater audio (experimental)"
						description="Projector hum on film detail pages plus a reel clack when you finish logging. Mutes automatically with reduced motion. Disabled by default; nothing autoplays without a gesture from you."
					/>
				</MeSettingsPanel>
			</MeSettingsSection>
		</SettingsSectionPage>
	);
}
