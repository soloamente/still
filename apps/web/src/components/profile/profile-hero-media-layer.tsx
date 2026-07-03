"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import type { ProfileBannerFrameId } from "@/lib/profile-appearance";
import { profileBannerFrameClass } from "@/lib/profile-appearance";
import {
	PROFILE_HERO_MEDIA_OVERSCAN_CLASSNAME,
	PROFILE_HERO_SCRIM_BOTTOM_VERTICAL_CLASSNAME,
	PROFILE_HERO_SCRIM_CARD_FADE_CLASSNAME,
	PROFILE_HERO_SCRIM_SIDE_CLASSNAME,
	PROFILE_HERO_SHELL_MEDIA_CLASSNAME,
} from "@/lib/profile-hero-layout";

/** Full-bleed profile banner — backdrop under portrait + identity (home taste-hero pattern). */
export function ProfileHeroMediaLayer({
	bannerSrc,
	bannerIsAnimated,
	accent,
	bannerFrame = "none",
}: {
	bannerSrc: string | null;
	bannerIsAnimated?: boolean;
	accent: string;
	bannerFrame?: ProfileBannerFrameId;
}) {
	return (
		<div
			className={cn(
				PROFILE_HERO_SHELL_MEDIA_CLASSNAME,
				profileBannerFrameClass(bannerFrame),
			)}
			aria-hidden
		>
			<div className="relative size-full">
				{bannerSrc ? (
					<div
						className={cn("absolute", PROFILE_HERO_MEDIA_OVERSCAN_CLASSNAME)}
					>
						{bannerIsAnimated ? (
							// biome-ignore lint/performance/noImgElement: Next Image does not animate GIF/WebP frames
							<img
								src={bannerSrc}
								alt=""
								className="size-full object-cover object-[center_42%]"
							/>
						) : (
							<Image
								src={bannerSrc}
								alt=""
								fill
								unoptimized
								priority
								sizes="100vw"
								className="object-cover object-[center_42%]"
							/>
						)}
					</div>
				) : (
					<div
						className={cn(
							"absolute bg-card",
							PROFILE_HERO_MEDIA_OVERSCAN_CLASSNAME,
						)}
						style={{
							background: `linear-gradient(120deg, ${accent}44, transparent 55%), var(--surface-card-base, var(--card))`,
						}}
					/>
				)}
				<div className={PROFILE_HERO_SCRIM_BOTTOM_VERTICAL_CLASSNAME} />
				<div className={PROFILE_HERO_SCRIM_SIDE_CLASSNAME} />
				<div className={PROFILE_HERO_SCRIM_CARD_FADE_CLASSNAME} />
			</div>
		</div>
	);
}
