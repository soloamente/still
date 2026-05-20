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

/**
 * Circular 24px country flag from `nucleo-flags` for streaming / region UI.
 */
export function CountryFlagIcon({
	countryCode,
	size = 24,
	className,
}: {
	countryCode: string;
	size?: number;
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
				"inline-flex shrink-0 overflow-hidden rounded-full bg-muted/30",
				className,
			)}
			aria-hidden
		>
			<Icon size={size} className="size-full object-cover" />
		</span>
	);
}
