"use client";

import type { ReactNode } from "react";

import { useHomeBrowseSurface } from "@/components/home/home-browse-surface-context";

/**
 * Renders Today on Sense only while the (optimistic) browse pill is **Movies**,
 * so tapping TV Shows or Community hides it instantly instead of after the RSC swap.
 */
export function HomeTodayBrowseGate({ children }: { children: ReactNode }) {
	const { activeBrowse } = useHomeBrowseSurface();
	if (activeBrowse !== "movies") return null;
	return <>{children}</>;
}
