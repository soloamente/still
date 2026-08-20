"use client";

import {
	RadialToolkit,
	type RadialToolkitItem,
} from "@still/ui/components/radial-toolkit";

import { useSenseRadialLiquidSlot } from "@/components/ui/sense-radial-liquid";

/**
 * Sense RMB radial — always injects the Morph rail (liquid-gooey when allowed).
 * Use this instead of bare `RadialToolkit` so the legacy blue ring never ships.
 */
export function SenseRadialToolkit({
	open,
	onOpenChange,
	anchor,
	items,
	title,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	anchor: { x: number; y: number } | null;
	items: RadialToolkitItem[];
	title?: string;
}) {
	const liquid = useSenseRadialLiquidSlot();
	return (
		<RadialToolkit
			open={open}
			onOpenChange={onOpenChange}
			anchor={anchor}
			items={items}
			title={title}
			liquid={liquid}
		/>
	);
}
