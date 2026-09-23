"use client";

import type { PlanTierId } from "@still/plans";
import { cn } from "@still/ui/lib/utils";
import type { CSSProperties } from "react";

import { AvatarAura } from "@/components/profile/avatar-aura/avatar-aura";
import { AVATAR_AURA_OUTER_SCALE } from "@/components/profile/avatar-aura/avatar-aura-frame-path";
import {
	hasAvatarAuraVisual,
	resolveAvatarAuraVisual,
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

import type { StaffRole } from "@/lib/staff-role-labels";

export type PatronPortraitWithAuraProps = PatronPortraitAvatarProps & {
	planTier?: PlanTierId | string | null;
	/** Staff rank — when set, shows the staff seal instead of plan-tier rim. */
	staffRole?: StaffRole | string | null;
	/** When false, skip the global online-now badge (e.g. decorative placeholders). */
	showOnlineStatus?: boolean;
	/**
	 * Listing snapshot state — when provided, renders the dot from server data
	 * instead of the global batch online lookup.
	 */
	presenceState?: PatronPresenceDotState | null;
};

/**
 * Patron portrait with plan-tier or staff scallop frame; hover sheen lives on AvatarAura.
 */
export function PatronPortraitWithAura({
	planTier,
	staffRole,
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

	const auraVisual = resolveAvatarAuraVisual({ planTier, staffRole });
	// Scale the layout box so the inset well keeps the intended face size; rim grows out.
	const showAura = hasAvatarAuraVisual(auraVisual) && circularPortrait;
	const layoutWidth = showAura ? width * AVATAR_AURA_OUTER_SCALE : width;
	const layoutHeight = showAura ? height * AVATAR_AURA_OUTER_SCALE : height;

	const auraExpandStyle: CSSProperties | undefined =
		showAura && fillsParent
			? {
					width: `${AVATAR_AURA_OUTER_SCALE * 100}%`,
					height: `${AVATAR_AURA_OUTER_SCALE * 100}%`,
					left: `${((1 - AVATAR_AURA_OUTER_SCALE) / 2) * 100}%`,
					top: `${((1 - AVATAR_AURA_OUTER_SCALE) / 2) * 100}%`,
				}
			: undefined;

	const portrait = showAura ? (
		<AvatarAura
			planTier={planTier}
			staffRole={staffRole}
			className={fillsParent ? "absolute" : "size-full"}
			style={auraExpandStyle}
		>
			<PatronPortraitAvatar
				handle={handle}
				{...avatarProps}
				width={width}
				height={height}
				className={cn(innerPortraitClassName, "rounded-full")}
			/>
		</AvatarAura>
	) : (
		<PatronPortraitAvatar
			handle={handle}
			className={innerPortraitClassName}
			width={width}
			height={height}
			{...avatarProps}
		/>
	);

	return (
		<span
			className={cn(
				"relative inline-flex shrink-0 overflow-visible",
				fillsParent && "size-full",
				className,
			)}
			style={
				style ??
				(fillsParent ? undefined : { width: layoutWidth, height: layoutHeight })
			}
		>
			{showAura ? (
				portrait
			) : (
				<span
					className={cn(
						"size-full overflow-hidden",
						circularPortrait ? "rounded-full" : "rounded-[inherit]",
					)}
				>
					{portrait}
				</span>
			)}
			{/* 14 must match AVATAR_AURA_WELL_INSET_PERCENT — static Tailwind so JIT keeps the class. */}
			<PatronOnlineDot
				presenceState={resolvedPresenceState}
				label={dotLabel}
				size={resolvePatronOnlineDotSize(width)}
				className={showAura ? "right-[14%] bottom-[14%]" : undefined}
			/>
		</span>
	);
}
