"use client";

import {
	RadialToolkit,
	type RadialToolkitAnchor,
	type RadialToolkitItem,
} from "@still/ui/components/radial-toolkit";
import { useLenis } from "lenis/react";
import { useEffect } from "react";

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
	anchor: RadialToolkitAnchor | null;
	items: RadialToolkitItem[];
	title?: string;
}) {
	const liquid = useSenseRadialLiquidSlot();
	const lenis = useLenis();
	const touchSession = open && anchor?.input === "touch";

	// `RadialToolkit` locks `html`/`body` overflow for touch sessions; Lenis
	// must pause too or it keeps driving window scroll during drag-to-aim.
	useEffect(() => {
		if (!touchSession || !lenis) return;
		lenis.stop();
		return () => lenis.start();
	}, [touchSession, lenis]);

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
