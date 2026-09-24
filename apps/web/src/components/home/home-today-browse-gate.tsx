"use client";

import type { ReactNode } from "react";

import { useHomeBrowseSurface } from "@/components/home/home-browse-surface-context";

/**
 * Today on Sense while the (optimistic) browse pill is Movies or TV Shows.
 * Community hides the block immediately. The inactive catalogue stays mounted
 * so its prefetch can finish; an optimistic pill swap shows that page before
 * the RSC payload lands.
 */
export function HomeTodayBrowseGate({
	children,
	inactive = null,
}: {
	children: ReactNode;
	/** The other catalogue's Today. Hidden until the pill moves off the URL browse. */
	inactive?: ReactNode;
}) {
	const { activeBrowse, urlBrowse } = useHomeBrowseSurface();
	if (activeBrowse !== "movies" && activeBrowse !== "tv") return null;
	const showInactive =
		inactive != null &&
		activeBrowse !== urlBrowse &&
		(urlBrowse === "movies" || urlBrowse === "tv");
	return (
		<>
			{/* `contents` keeps the active page in the lobby flow; `hidden` parks the other. */}
			<div className={showInactive ? "hidden" : "contents"}>{children}</div>
			{inactive != null ? (
				<div className={showInactive ? "contents" : "hidden"}>{inactive}</div>
			) : null}
		</>
	);
}
