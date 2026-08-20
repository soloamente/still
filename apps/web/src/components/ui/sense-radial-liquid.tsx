"use client";

import type {
	RadialToolkitLiquidItemProps,
	RadialToolkitLiquidRootProps,
	RadialToolkitLiquidSlot,
} from "@still/ui/components/radial-toolkit";

import {
	SenseLiquid,
	SenseLiquidItem,
	type SenseLiquidItemProps,
	useSenseLiquidEnabled,
} from "@/components/ui/sense-liquid";

/**
 * PlusMenu playground defaults:
 * `<Liquid blur={6} contrast={18}>` + `<Liquid.Item transition="bouncy" delay={40}>`
 * Theme `card` fill only (pill faces stay themed; goo physics match the demo).
 */
const RADIAL_BLUR = 6;
const RADIAL_CONTRAST = 18;
const RADIAL_FILTER_PADDING = 56;

/** Theme-card Morph host — blur/contrast locked to PlusMenu. */
export function SenseRadialLiquidRoot({
	className,
	style,
	children,
	blur = RADIAL_BLUR,
	contrast = RADIAL_CONTRAST,
	fill,
	filterPadding = RADIAL_FILTER_PADDING,
	shadow,
}: RadialToolkitLiquidRootProps) {
	return (
		<SenseLiquid
			enabled
			fillRole="card"
			fill={fill}
			blur={blur}
			contrast={contrast}
			filterPadding={filterPadding}
			shadow={shadow}
			className={className}
			style={style}
		>
			{children}
		</SenseLiquid>
	);
}

/**
 * Passthrough Item — radial toolkit passes a slower spring than preset `bouncy`.
 */
export function SenseRadialLiquidItem({
	transition,
	morph,
	...rest
}: RadialToolkitLiquidItemProps) {
	// Radial toolkit keeps transition/morph loose; liquid-gooey Item types are narrower.
	return (
		<SenseLiquidItem
			transition={transition as SenseLiquidItemProps["transition"]}
			morph={morph as SenseLiquidItemProps["morph"]}
			{...rest}
		/>
	);
}

/**
 * Slot for `RadialToolkit` `liquid` prop — gated on reduced-motion + software GPU.
 */
export function useSenseRadialLiquidSlot(): RadialToolkitLiquidSlot {
	const enabled = useSenseLiquidEnabled();
	return {
		enabled,
		Root: SenseRadialLiquidRoot,
		Item: SenseRadialLiquidItem,
	};
}
