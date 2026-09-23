"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";

import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";

/**
 * Opens the streaming-region prompt in place (no detour to Settings) and
 * re-runs the `/watchlist` RSC fetch once a region is saved.
 */
export function WatchlistRegionAction({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const handleClose = useCallback(
		(saved: boolean) => {
			setOpen(false);
			if (saved) router.refresh();
		},
		[router],
	);
	return (
		<>
			<button type="button" className={className} onClick={() => setOpen(true)}>
				{children}
			</button>
			<CatalogWatchRegionPrompt open={open} onClose={handleClose} />
		</>
	);
}

/** Region signal from `GET /api/watchlist`: ISO code, `"ALL"`, or null (unset). */
export function watchlistRegionNeedsGuidance(
	region: string | null | undefined,
): boolean {
	return region === null || region === "ALL";
}

/** Guidance copy — "All countries" is a real choice, so it gets its own line. */
export function watchlistRegionGuidanceCopy(region: string | null): string {
	return region === "ALL"
		? "You're browsing all countries — pick one to see what's streaming for you."
		: "Set your streaming region to rank what's on your services.";
}
