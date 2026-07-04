"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { usePatronEntitlements } from "@/components/plans/use-patron-entitlements";
import { MePreferenceToggle } from "@/components/profile/me-preference-toggle";
import {
	PROFILE_ACCENT_PRESETS,
	PROFILE_BANNER_FRAMES,
	type ProfileAccentId,
	type ProfileBannerFrameId,
} from "@/lib/profile-appearance";

export function MeProfileExpressionSettings({
	profileAccent,
	bannerFrame,
	onProfileAccentChange,
	onBannerFrameChange,
	profilePortraitGrayscaleUntilHover,
	onProfilePortraitGrayscaleUntilHoverChange,
}: {
	profileAccent: ProfileAccentId | null;
	bannerFrame: ProfileBannerFrameId;
	onProfileAccentChange: (next: ProfileAccentId) => void;
	onBannerFrameChange: (next: ProfileBannerFrameId) => void;
	profilePortraitGrayscaleUntilHover: boolean;
	onProfilePortraitGrayscaleUntilHoverChange: (next: boolean) => void;
}) {
	const { hasFeature } = usePatronEntitlements();
	const hasProfileCustomization = hasFeature("profile_customization");
	const accentEntries = Object.entries(PROFILE_ACCENT_PRESETS) as [
		ProfileAccentId,
		(typeof PROFILE_ACCENT_PRESETS)[ProfileAccentId],
	][];
	const frameEntries = Object.entries(PROFILE_BANNER_FRAMES) as [
		ProfileBannerFrameId,
		(typeof PROFILE_BANNER_FRAMES)[ProfileBannerFrameId],
	][];

	return (
		<div className="space-y-8 pt-2">
			<div className="space-y-1">
				<p className="font-medium text-foreground text-sm">
					Profile expression
				</p>
				<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
					{hasProfileCustomization
						? "Accent and banner frame show on your public profile. Pick a frame, then Save — accent is optional."
						: "Immersed unlocks accent presets and banner frames. Upgrade to customize how your profile looks."}
				</p>
				{!hasProfileCustomization ? (
					<Link
						href="/pricing#immersed"
						className="inline-block font-medium text-foreground text-sm underline-offset-4 [@media(hover:hover)]:hover:underline"
					>
						View Immersed plans
					</Link>
				) : null}
			</div>

			<div className="space-y-3">
				<p className="font-medium text-foreground text-sm">Accent</p>
				<fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2 lg:grid-cols-4">
					<legend className="sr-only">Profile accent</legend>
					{accentEntries.map(([id, def]) => {
						const selected = profileAccent === id;
						const inputId = `profile-accent-${id}`;
						return (
							<label
								key={id}
								htmlFor={inputId}
								className={cn(
									"flex cursor-pointer items-center gap-3 rounded-2xl bg-background p-3 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
									!hasProfileCustomization && "cursor-not-allowed opacity-50",
									selected
										? "text-foreground"
										: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
								)}
							>
								<input
									id={inputId}
									type="radio"
									name="profile-accent"
									className="sr-only"
									checked={selected}
									disabled={!hasProfileCustomization}
									onChange={() => onProfileAccentChange(id)}
								/>
								<span
									className="size-9 shrink-0 rounded-full"
									style={{ background: def.hex }}
									aria-hidden
								/>
								<span className="font-medium text-sm">{def.label}</span>
							</label>
						);
					})}
				</fieldset>
			</div>

			<div className="space-y-3">
				<p className="font-medium text-foreground text-sm">Banner frame</p>
				<fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-3">
					<legend className="sr-only">Banner frame</legend>
					{frameEntries.map(([id, def]) => {
						const selected = bannerFrame === id;
						const inputId = `banner-frame-${id}`;
						return (
							<label
								key={id}
								htmlFor={inputId}
								className={cn(
									"flex cursor-pointer flex-col gap-1 rounded-2xl bg-background p-4 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
									!hasProfileCustomization && "cursor-not-allowed opacity-50",
									selected
										? "text-foreground"
										: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
								)}
							>
								<input
									id={inputId}
									type="radio"
									name="banner-frame"
									className="sr-only"
									checked={selected}
									disabled={!hasProfileCustomization}
									onChange={() => onBannerFrameChange(id)}
								/>
								<span className="font-medium text-sm">{def.label}</span>
								<span className="text-muted-foreground text-xs leading-relaxed">
									{def.description}
								</span>
							</label>
						);
					})}
				</fieldset>
			</div>

			<MePreferenceToggle
				id="profile-portrait-grayscale-hover"
				checked={profilePortraitGrayscaleUntilHover}
				onChange={onProfilePortraitGrayscaleUntilHoverChange}
				title="Grayscale portrait until hover"
				description="On your public profile, your portrait stays monochrome until a visitor hovers. Off keeps full color on the profile hero. Does not affect small avatars elsewhere."
			/>
		</div>
	);
}
