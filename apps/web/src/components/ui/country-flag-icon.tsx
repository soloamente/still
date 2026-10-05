"use client";

import { cn } from "@still/ui/lib/utils";
import type { IconProps } from "nucleo-flags";
import * as NucleoFlags from "nucleo-flags";
import type { ComponentType } from "react";

import {
	NUCLEO_FLAG_BY_ISO,
	type NucleoFlagIconName,
} from "@/lib/nucleo-flag-by-iso";

type NucleoFlagComponent = ComponentType<IconProps>;

const FLAG_ICONS = NucleoFlags as Record<
	NucleoFlagIconName,
	NucleoFlagComponent
>;

/** 2px canvas gap ring — separates the flag from the logo; no drop shadow. */
export const COUNTRY_FLAG_RIM_SHADOW = "shadow-[0_0_0_2px_var(--background)]";

/** Bottom-right rim badge position on circular provider logos (search streaming rail). */
export const COUNTRY_FLAG_RIM_BADGE_POSITION_CLASS =
	"pointer-events-none absolute right-0 bottom-0 z-10 translate-x-[14%] translate-y-[14%]";

/**
 * Circular 24px country flag from `nucleo-flags` for streaming / region UI.
 */
export function CountryFlagIcon({
	countryCode,
	size = 24,
	/** Circular clip for provider rims; rectangular flags keep the full mark. */
	shape = "circle",
	className,
}: {
	countryCode: string;
	size?: number;
	shape?: "circle" | "rect";
	className?: string;
}) {
	const iconName =
		NUCLEO_FLAG_BY_ISO[
			countryCode.toUpperCase() as keyof typeof NUCLEO_FLAG_BY_ISO
		];
	if (!iconName) return null;

	const Icon = FLAG_ICONS[iconName];
	if (!Icon) return null;

	return (
		<span
			className={cn(
				"inline-flex shrink-0 overflow-hidden bg-muted/30",
				shape === "circle" ? "rounded-full" : "rounded-none bg-transparent",
				className,
			)}
			aria-hidden
		>
			<Icon size={size} className="size-full object-cover" />
		</span>
	);
}

/** Nucleo flag on the provider logo rim — background ring separates it from the artwork. */
export function CountryFlagRimBadge({
	countryCode,
	className,
	flagSize = 14,
}: {
	countryCode: string;
	className?: string;
	flagSize?: number;
}) {
	return (
		<span
			className={cn(
				COUNTRY_FLAG_RIM_BADGE_POSITION_CLASS,
				"inline-flex overflow-hidden rounded-full bg-card",
				COUNTRY_FLAG_RIM_SHADOW,
				className,
			)}
		>
			<CountryFlagIcon
				countryCode={countryCode}
				size={flagSize}
				className="size-3.5"
			/>
		</span>
	);
}
