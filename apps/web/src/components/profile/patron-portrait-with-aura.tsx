"use client";

import type { PlanTierId } from "@still/plans";
import { cn } from "@still/ui/lib/utils";

import { AvatarAura } from "@/components/profile/avatar-aura/avatar-aura";
import {
	hasAvatarAura,
	resolveAvatarAuraTier,
} from "@/components/profile/avatar-aura/avatar-aura-tier";
import {
	PatronOnlineDot,
	type PatronPresenceDotState,
	resolvePatronOnlineDotSize,
} from "@/components/profile/patron-online-dot";
import {
	PatronPortraitAvatar,
	type PatronPortraitAvatarProps,
} from "@/components/profile/patron-portrait-avatar";
import {
	usePatronPresenceState,
	useViewerHandleForPresence,
} from "@/components/realtime/patron-online-provider";
import { isCircularPatronPortraitClass } from "@/lib/diary-metal-tier";
import { formatPatronPresenceDotLabel } from "@/lib/listing-presence-copy";
import { normalizePatronOnlineHandle } from "@/lib/patron-online-presence";

export type PatronPortraitWithAuraProps = PatronPortraitAvatarProps & {
	planTier?: PlanTierId | string | null;
	/** When false, skip the global online-now badge (e.g. decorative placeholders). */
	showOnlineStatus?: boolean;
	/**
	 * Listing snapshot state — when provided, renders the dot from server data
	 * instead of the global batch online lookup.
	 */
	presenceState?: PatronPresenceDotState | null;
};

/**
 * Patron portrait with subscription-tier aura — static OKLCH rim plus tier hover
 * effects (Attuned sweep, Immersed glow, Devoted WebGL/CSS holo).
 */
export function PatronPortraitWithAura({
	planTier,
	className,
	width = 72,
	height = 72,
	showOnlineStatus = true,
	presenceState: presenceStateProp,
	handle,
	style,
	...avatarProps
}: PatronPortraitWithAuraProps) {
	const viewerHandle = useViewerHandleForPresence();
	const circularPortrait = isCircularPatronPortraitClass(className);
	const fillsParent = Boolean(className?.includes("size-full"));
	const useGlobalPresence = showOnlineStatus && presenceStateProp === undefined;
	const globalPresenceState = usePatronPresenceState(
		useGlobalPresence ? handle : undefined,
		useGlobalPresence,
	);

	const resolvedPresenceState: PatronPresenceDotState | null = !showOnlineStatus
		? null
		: presenceStateProp !== undefined
			? presenceStateProp
			: globalPresenceState;

	const normalizedHandle = handle?.trim() ?? "";
	const isViewerSelf =
		normalizedHandle.length > 0 &&
		Boolean(viewerHandle) &&
		normalizePatronOnlineHandle(normalizedHandle) === viewerHandle;

	const dotLabel =
		resolvedPresenceState && handle
			? formatPatronPresenceDotLabel(handle, resolvedPresenceState, {
					perspective: isViewerSelf ? "self" : "other",
				})
			: "";

	const innerPortraitClassName = cn(
		"size-full object-cover",
		circularPortrait ? "rounded-full" : "rounded-[inherit]",
	);

	const tier = resolveAvatarAuraTier(planTier);
	const portrait =
		!hasAvatarAura(tier) || !circularPortrait ? (
			<PatronPortraitAvatar
				handle={handle}
				className={innerPortraitClassName}
				width={width}
				height={height}
				{...avatarProps}
			/>
		) : (
			<AvatarAura tier={tier}>
				<PatronPortraitAvatar
					handle={handle}
					{...avatarProps}
					width={width}
					height={height}
					className={cn(innerPortraitClassName, "rounded-full")}
				/>
			</AvatarAura>
		);

	return (
		<span
			className={cn(
				"relative inline-flex shrink-0 overflow-visible",
				fillsParent && "size-full",
				className,
			)}
			style={style ?? (fillsParent ? undefined : { width, height })}
		>
			{/* Clip portrait to rounded tile; keep outer overflow visible so the status dot can sit on the rim. */}
			<span
				className={cn(
					"size-full overflow-hidden",
					circularPortrait ? "rounded-full" : "rounded-[inherit]",
				)}
			>
				{portrait}
			</span>
			<PatronOnlineDot
				presenceState={resolvedPresenceState}
				label={dotLabel}
				size={resolvePatronOnlineDotSize(width)}
			/>
		</span>
	);
}
