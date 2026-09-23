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
	// Only undo our own pause — a drawer (`useLockDrawerScroll`) may already have
	// stopped Lenis, and restarting it would scroll the page behind the sheet.
	useEffect(() => {
		if (!touchSession || !lenis || lenis.isStopped) return;
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
