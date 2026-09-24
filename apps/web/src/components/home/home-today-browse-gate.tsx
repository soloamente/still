"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { useHomeBrowseSurface } from "@/components/home/home-browse-surface-context";
import { todaySlideExitEnabled, todaySlidePage } from "@/lib/home-today-slide";

/**
 * Today on Sense while the (optimistic) browse pill is Movies or TV Shows.
 * Community hides the block immediately. Both catalogues stay mounted so the
 * inactive side can prefetch and Movies ↔ TV can slide without remounting.
 */
export function HomeTodayBrowseGate({
	movie,
	tv,
}: {
	movie: ReactNode;
	tv: ReactNode;
}) {
	const { activeBrowse } = useHomeBrowseSurface();
	// First paint: disable exit motion so the active page does not fly in from off-screen.
	const [hasShownOnce, setHasShownOnce] = useState(false);
	useEffect(() => {
		setHasShownOnce(true);
	}, []);

	if (activeBrowse !== "movies" && activeBrowse !== "tv") return null;

	const page = todaySlidePage(activeBrowse === "tv" ? "tv" : "movies");

	return (
		<div
			className="t-today-slide"
			data-page={page}
			style={{
				["--page-exit-enabled" as string]: todaySlideExitEnabled(hasShownOnce),
			}}
		>
			<section className="t-page" data-page-id="1">
				{movie}
			</section>
			<section className="t-page" data-page-id="2">
				{tv}
			</section>
		</div>
	);
}
