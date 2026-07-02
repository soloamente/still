"use client";

import type { ReactNode } from "react";

import { HomeBrowseSurfaceProvider } from "@/components/home/home-browse-surface-context";
import { HomeTasteHeroTrailerProvider } from "@/components/home/home-taste-hero-trailer-context";
import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";

/**
 * Single navigation context for `/home` — browse rail, TMDb chips, and Community
 * period/feed all share one `useLobbyTransition` instance.
 */
export function HomeLobbyNavigationRoot({ children }: { children: ReactNode }) {
	return (
		<LobbyNavigationProvider>
			<HomeBrowseSurfaceProvider>
				<HomeTasteHeroTrailerProvider>{children}</HomeTasteHeroTrailerProvider>
			</HomeBrowseSurfaceProvider>
		</LobbyNavigationProvider>
	);
}
