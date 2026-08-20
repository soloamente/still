"use client";

import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import type { ReactNode } from "react";
import { useState } from "react";
import { PlanFeatureGate } from "@/components/plans/plan-feature-gate";
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
import { MeDiscordConnect } from "@/components/profile/me-discord-connect";
import {
	MeFormField,
	meFieldControlClass,
} from "@/components/profile/me-form-field";
import { MeLetterboxdImport } from "@/components/profile/me-letterboxd-import";
import { MePreferenceToggle } from "@/components/profile/me-preference-toggle";
import { MeProfileVisibilityToggle } from "@/components/profile/me-profile-visibility-toggle";
import { MeReviewLanguageSelect } from "@/components/profile/me-review-language-select";
import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";
import { ProfileMediaCustomizer } from "@/components/profile/profile-media-customizer";
import { useSettingsForm } from "@/components/profile/settings-form-context";
import { patronMeetsAdultAgeGate } from "@/lib/adult-content-age-gate";
import { authClient } from "@/lib/auth-client";
import { notificationSettingsSections } from "@/lib/notification-preferences";
import { resolveCatalogTmdbLanguage } from "@/lib/profile-preferences";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

function SettingsSectionPage({
	children,
	/** When false, every section stays content-sized (Profile / Data). Default grows the first block. */
	fillFirst = true,
}: {
	children: ReactNode;
	fillFirst?: boolean;
}) {
	// `fillFirst` also owns the reveal shell. A content-sized stack inside a
	// `flex-1 min-h-0` wrapper still paints as an empty flex slab on ultrawide.
	const stretchShell = fillFirst;
	return (
		<MeAccountContentReveal
			className={
				stretchShell
					? "flex min-h-0 flex-1 flex-col space-y-0"
					: "flex flex-col space-y-0"
			}
		>
			<MeAccountRevealItem
				className={
					stretchShell ? "flex min-h-0 flex-1 flex-col" : "flex flex-col"
				}
			>
				{/*
				 * Single-section pages (Catalogue, Appearance, …): the only child grows.
				 * Multi-section (Profile, Data, Experience, Catalogue, Notifications):
				 * content-sized shell — leftover lobby height is the `bg-card` canvas,
				 * not an empty column.
				 */}
				<div
					className={
						fillFirst
							? "flex min-h-0 flex-1 flex-col gap-12 pb-4 lg:gap-14 [&>*:first-child]:min-h-0 [&>*:first-child]:flex-1 [&>*:not(:first-child)]:flex-none"
							: "flex flex-col gap-12 pb-4 lg:gap-14"
					}
				>
					{children}
				</div>
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
		<SettingsSectionPage fillFirst={false}>
			{/* Identity: photo + public fields only — no privacy toggles in this panel. */}
			<MeSettingsSection
				className="flex-none"
				title="Identity"
				description="Photo, public identity, and links on your page."
			>
				<ProfileMediaCustomizer
					handle={profile.handle}
					bannerUrl={profile.bannerUrl ?? null}
					hasAvatar={Boolean(profile.hasAvatar)}
					isPro={isPro}
					disabled={saving}
				/>
				<MeSettingsPanel className="flex flex-none flex-col">
					<div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] xl:items-start xl:gap-8">
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
				</MeSettingsPanel>
			</MeSettingsSection>

			{/*
			 * Privacy & presence: labeled visibility, birthday display, online audience.
			 * Leading-aligned stack (no `items-end`) so ultrawide doesn’t park chips on the right edge.
			 */}
			<MeSettingsSection
				className="flex-none"
				title="Privacy & presence"
				description="Who can see your page, birthday, and online status."
			>
				{/* `t-resize` tweens explicit size changes when birthday / email blocks reflow. */}
				<MeSettingsPanel className="t-resize flex flex-none flex-col space-y-6">
					{showEmailVerificationNote ? (
						<p className="max-w-md text-pretty text-muted-foreground text-sm">
							Verify your email before making your profile or posts public.
						</p>
					) : null}
					<div className="space-y-3">
						<div className="space-y-1">
							<p className="font-medium text-foreground text-sm">
								Profile visibility
							</p>
							<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
								Public profiles can be found in search and Community. Private
								keeps your diary closed until you accept follow requests.
							</p>
						</div>
						<MeProfileVisibilityToggle
							checked={isPrivate}
							onChange={setIsPrivate}
						/>
					</div>
					<MePreferenceToggle
						id="show-birthday-on-profile"
						checked={Boolean(birthDate) && showBirthDateOnProfile}
						disabled={!birthDate}
						onChange={(next) => {
							if (!birthDate) return;
							setShowBirthDateOnProfile(next);
						}}
						title="Show birthday on profile"
						description={
							birthDate
								? "Visitors see month and day only — never your birth year."
								: "Add your date of birth in Identity above to show it on your profile."
						}
					/>
					<MePreferenceToggle
						id="presence-visibility"
						checked={presenceVisibility === "public"}
						onChange={(next) =>
							setPresenceVisibility(next ? "public" : "friends")
						}
						title="Show online status to everyone"
						description="When off, only Friends can see when you’re online across Sense."
						onLabel="Public"
						offLabel="Friends only"
					/>
				</MeSettingsPanel>
			</MeSettingsSection>

			{/*
			 * Sibling section + one panel — Discord uses `surface="plain"` so we never
			 * nest MeSettingsPanel inside another panel. Section `title` owns the landmark;
			 * blurb + in-panel UI are pitch / actions only (see MeDiscordConnect).
			 */}
			<MeSettingsSection
				className="flex-none"
				title="Discord activity"
				description="Show what you’re listening to or playing on your profile."
			>
				<MeSettingsPanel className="flex-none">
					<MeDiscordConnect surface="plain" />
				</MeSettingsPanel>
			</MeSettingsSection>
		</SettingsSectionPage>
	);
}

export function SettingsNotificationsSection() {
	const { notificationPrefs, setNotificationPref } = useSettingsForm();

	return (
		<SettingsSectionPage fillFirst={false}>
			{/*
			 * Ultrawide: Social | Watching | Milestones. Same outer cards.
			 * One untitled list used to stretch the lobby column.
			 */}
			<div className="grid gap-12 xl:grid-cols-3 xl:items-start xl:gap-14">
				{notificationSettingsSections().map((section) => (
					<MeSettingsSection
						key={section.group}
						className="flex-none"
						title={section.title}
						description={section.description}
					>
						<MeSettingsPanel className="flex-none space-y-8">
							{section.entries.map((entry) => (
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
				))}
			</div>
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
		reviewTranslationLanguage,
		setReviewTranslationLanguage,
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
		<SettingsSectionPage fillFirst={false}>
			<AdultContentEnableDialog
				open={adultEnableOpen}
				onOpenChange={setAdultEnableOpen}
				onConfirm={(nextBirthDate) =>
					void enableAdultContentWithBirthDate(nextBirthDate)
				}
			/>
			{/*
			 * Ultrawide: Streaming | Language, Display full-width under.
			 * Same outer `bg-background` cards — no featured wash on one column.
			 */}
			<div className="grid gap-12 xl:grid-cols-2 xl:items-start xl:gap-14">
				<MeSettingsSection
					className="flex-none"
					title="Streaming"
					description="Where At home lists and cinema dates come from."
				>
					<MeSettingsPanel className="flex-none space-y-8">
						<MeFormField
							id="catalogTmdbWatchRegion"
							label="Watch region"
							hint="At home lists use this region. In cinemas uses the same country for release dates when you pick a code — not All countries. Leave unset to choose on first visit."
						>
							<MeCatalogWatchRegionSelect
								id="catalogTmdbWatchRegion"
								value={catalogTmdbWatchRegion}
								onChange={setCatalogTmdbWatchRegion}
							/>
						</MeFormField>
						<PlanFeatureGate featureKey="watchlist_alerts">
							<MePreferenceToggle
								id="watchlist-streaming-alerts"
								checked={watchlistStreamingAlerts}
								onChange={setWatchlistStreamingAlerts}
								title="Notify when watchlisted titles stream near me"
								description="Uses your watch region. Sense checks cached streaming data daily and pings your inbox when a saved title lands on a new service."
							/>
						</PlanFeatureGate>
					</MeSettingsPanel>
				</MeSettingsSection>
				<MeSettingsSection
					className="flex-none"
					title="Language"
					description="Titles, tags, and the language reviews translate into."
				>
					<MeSettingsPanel className="flex-none space-y-8">
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
						<MeFormField
							id="reviewTranslationLanguage"
							label="Translate reviews into"
							hint="Reviews in another language get a translate control in the reader. Nothing is translated until you ask."
						>
							<MeReviewLanguageSelect
								id="reviewTranslationLanguage"
								value={reviewTranslationLanguage}
								onChange={setReviewTranslationLanguage}
							/>
						</MeFormField>
					</MeSettingsPanel>
				</MeSettingsSection>
				<MeSettingsSection
					className="flex-none xl:col-span-2"
					title="Display"
					description="How the home catalogue looks, and whether 18+ titles appear."
				>
					<MeSettingsPanel className="grid flex-none gap-8 sm:grid-cols-2">
						<MePreferenceToggle
							id="catalog-monochrome-hover"
							checked={catalogMonochromePeersOnHover}
							onChange={setCatalogMonochromePeersOnHover}
							title="Monochrome neighbors on hover"
							description="On the home catalogue, posters you are not pointing at turn grayscale while one title is hovered. Off keeps every tile in full color."
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
			</div>
		</SettingsSectionPage>
	);
}

export function SettingsAppearanceSection() {
	const {
		hasFeature,
		appTheme,
		setAppTheme,
		profilePortraitGrayscaleUntilHover,
		setProfilePortraitGrayscaleUntilHover,
	} = useSettingsForm();
	const hasAllThemes = hasFeature("all_themes");

	return (
		<SettingsSectionPage>
			<MeSettingsSection description="Named color palettes for the whole app.">
				<MeSettingsPanel>
					<MeAppearanceSettings
						isPro={hasAllThemes}
						appTheme={appTheme}
						onAppThemeChange={setAppTheme}
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
		<SettingsSectionPage fillFirst={false}>
			{/*
			 * Ultrawide: imports lead; export + danger sit in a trailing rail.
			 * Narrow: one column, same order (imports, then take-data-out).
			 */}
			<div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] xl:items-start xl:gap-14">
				<div className="flex flex-col gap-12 lg:gap-14">
					<MeLetterboxdImport />
					<MeAnilistImport />
				</div>
				<div className="flex flex-col gap-12 lg:gap-14">
					<MeDataExportPanel />
					<MeDangerZone />
				</div>
			</div>
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
		<SettingsSectionPage fillFirst={false}>
			{/*
			 * Ultrawide: motion/picture lead; audio sits beside them.
			 * One featured slab used to stretch the whole lobby column.
			 */}
			<div className="grid gap-12 xl:grid-cols-2 xl:items-start xl:gap-14">
				<MeSettingsSection
					className="flex-none"
					title="Motion & picture"
					description="How the app moves and how stills look. All optional, off by default."
				>
					<MeSettingsPanel className="flex-none space-y-8">
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
					</MeSettingsPanel>
				</MeSettingsSection>
				<MeSettingsSection
					className="flex-none"
					title="Audio"
					description="Cinema atmosphere and milestone cues. Nothing autoplays without a gesture from you."
				>
					<MeSettingsPanel className="flex-none space-y-8">
						<MePreferenceToggle
							id="sense-audio-enabled"
							checked={profileAudioEnabled}
							onChange={setProfileAudioEnabled}
							title="Sense audio (experimental)"
							description="Optional projector hum and milestone feedback. Off by default."
						/>
						{profileAudioEnabled ? (
							<fieldset className="m-0 space-y-6 rounded-2xl border-0 bg-foreground/4 p-5">
								<legend className="sr-only">Atmosphere and feedback</legend>
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
							</fieldset>
						) : null}
						{prefersReducedMotion ? (
							<p className="text-pretty text-muted-foreground text-sm">
								Reduced motion is on — audio cues stay muted until you turn it
								off in system settings.
							</p>
						) : null}
					</MeSettingsPanel>
				</MeSettingsSection>
			</div>
		</SettingsSectionPage>
	);
}
