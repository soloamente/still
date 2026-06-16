"use client";

import { cn } from "@still/ui/lib/utils";
import { BorderBeam } from "border-beam";
import {
	PatronOnlineDot,
	resolvePatronOnlineDotSize,
} from "@/components/profile/patron-online-dot";
import {
	PatronPortraitAvatar,
	type PatronPortraitAvatarProps,
} from "@/components/profile/patron-portrait-avatar";
import { usePatronOnlineStatus } from "@/components/realtime/patron-online-provider";
import {
	DIARY_METAL_BORDER_BEAM_STRENGTH,
	type DiaryMetalTier,
	diaryMetalBorderBeamColorVariant,
	isCircularPatronPortraitClass,
} from "@/lib/diary-metal-tier";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export type PatronPortraitWithMetalTierProps = PatronPortraitAvatarProps & {
	diaryMetalTier?: DiaryMetalTier | null;
	/** When false, skip the global online-now badge (e.g. decorative placeholders). */
	showOnlineStatus?: boolean;
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
	showOnlineStatus = true,
	handle,
	style,
	...avatarProps
}: PatronPortraitWithMetalTierProps) {
	const reducedMotion = usePrefersReducedMotion();
	const circularPortrait = isCircularPatronPortraitClass(className);
	const isOnline = usePatronOnlineStatus(
		showOnlineStatus ? handle : undefined,
		showOnlineStatus,
	);

	const innerPortraitClassName = cn(
		"size-full object-cover",
		circularPortrait ? "rounded-full" : "rounded-[inherit]",
	);

	const portrait =
		!diaryMetalTier || !circularPortrait ? (
			<PatronPortraitAvatar
				handle={handle}
				className={innerPortraitClassName}
				width={width}
				height={height}
				{...avatarProps}
			/>
		) : (
			<BorderBeam
				size="pulse-outside"
				theme="auto"
				colorVariant={diaryMetalBorderBeamColorVariant(diaryMetalTier)}
				borderRadius={9999}
				active={!reducedMotion}
				strength={DIARY_METAL_BORDER_BEAM_STRENGTH}
				className="inline-flex size-full shrink-0 overflow-visible"
			>
				<PatronPortraitAvatar
					handle={handle}
					{...avatarProps}
					width={width}
					height={height}
					className={cn(innerPortraitClassName, "rounded-full")}
				/>
			</BorderBeam>
		);

	return (
		<span
			className={cn(
				"relative inline-flex shrink-0 overflow-visible",
				className,
			)}
			style={style ?? { width, height }}
		>
			{portrait}
			<PatronOnlineDot
				presenceState={isOnline ? "active" : null}
				label={`@${handle} online now`}
				size={resolvePatronOnlineDotSize(width)}
			/>
		</span>
	);
}
