"use client";

import { cn } from "@still/ui/lib/utils";
import { BorderBeam } from "border-beam";

import {
	PatronPortraitAvatar,
	type PatronPortraitAvatarProps,
} from "@/components/profile/patron-portrait-avatar";
import {
	DIARY_METAL_BORDER_BEAM_STRENGTH,
	type DiaryMetalTier,
	diaryMetalBorderBeamColorVariant,
	isCircularPatronPortraitClass,
} from "@/lib/diary-metal-tier";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export type PatronPortraitWithMetalTierProps = PatronPortraitAvatarProps & {
	diaryMetalTier?: DiaryMetalTier | null;
};

/**
 * Patron portrait with diary-volume ring — `border-beam` pulse outside the avatar,
 * `colorVariant` follows diary volume — silver / gold / chromatic.
 */
export function PatronPortraitWithMetalTier({
	diaryMetalTier,
	className,
	width = 72,
	height = 72,
	...avatarProps
}: PatronPortraitWithMetalTierProps) {
	const reducedMotion = usePrefersReducedMotion();
	const circularPortrait = isCircularPatronPortraitClass(className);

	if (!diaryMetalTier || !circularPortrait) {
		return (
			<PatronPortraitAvatar
				className={className}
				width={width}
				height={height}
				{...avatarProps}
			/>
		);
	}

	return (
		<BorderBeam
			size="pulse-outside"
			theme="auto"
			colorVariant={diaryMetalBorderBeamColorVariant(diaryMetalTier)}
			borderRadius={9999}
			active={!reducedMotion}
			strength={DIARY_METAL_BORDER_BEAM_STRENGTH}
			className="inline-flex shrink-0 overflow-visible"
		>
			<PatronPortraitAvatar
				{...avatarProps}
				width={width}
				height={height}
				className={cn(className, "rounded-full")}
				style={{ width, height }}
			/>
		</BorderBeam>
	);
}
