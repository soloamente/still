"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { usePatronEntitlements } from "@/components/plans/use-patron-entitlements";
import { MePreferenceToggle } from "@/components/profile/me-preference-toggle";
import {
	PROFILE_BANNER_FRAMES,
	type ProfileBannerFrameId,
} from "@/lib/profile-appearance";

/**
 * Immersed profile expression — banner frame + portrait grayscale.
 * Profile accent presets are hidden for now (did not land well in product).
 */
export function MeProfileExpressionSettings({
	bannerFrame,
	onBannerFrameChange,
	profilePortraitGrayscaleUntilHover,
	onProfilePortraitGrayscaleUntilHoverChange,
}: {
	bannerFrame: ProfileBannerFrameId;
	onBannerFrameChange: (next: ProfileBannerFrameId) => void;
	profilePortraitGrayscaleUntilHover: boolean;
	onProfilePortraitGrayscaleUntilHoverChange: (next: boolean) => void;
}) {
	const { hasFeature } = usePatronEntitlements();
	const hasProfileCustomization = hasFeature("profile_customization");
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
						? "Banner frame shows on your public profile. Pick a frame, then Save."
						: "Immersed unlocks banner frames on your public profile. Upgrade to customize how your profile looks."}
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
