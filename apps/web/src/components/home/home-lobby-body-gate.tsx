"use client";

import type { ReactNode } from "react";

import { CommunityLobbySkeleton } from "@/components/home/community-lobby-skeleton";
import { useHomeBrowseSurface } from "@/components/home/home-browse-surface-context";
import { HomeTmdbCatalogueGrid } from "@/components/home/home-tmdb-lobby-chrome";
import { TmdbLobbySkeleton } from "@/components/home/tmdb-lobby-skeleton";
import type { HomeBrowseSurface } from "@/lib/home-browse-surface";

type LobbyBodyGateMode = "community-pending" | "tmdb-pending" | "settled";

function resolveLobbyBodyGateMode(
	activeBrowse: HomeBrowseSurface,
	urlBrowse: HomeBrowseSurface,
): LobbyBodyGateMode {
	if (activeBrowse === "community" && urlBrowse !== "community") {
		return "community-pending";
	}
	if (activeBrowse !== "community" && urlBrowse === "community") {
		return "tmdb-pending";
	}
	return "settled";
}

/**
 * Swaps catalogue body during optimistic browse-surface navigation so patrons
 * never stare at the wrong lobby (Movies grid while Community pill is active).
 */
export function HomeLobbyBodyGate({
	urlBrowse,
	children,
}: {
	urlBrowse: HomeBrowseSurface;
	children: ReactNode;
}) {
	const { activeBrowse } = useHomeBrowseSurface();
	const mode = resolveLobbyBodyGateMode(activeBrowse, urlBrowse);

	if (mode === "community-pending") {
		return <CommunityLobbySkeleton />;
	}

	if (mode === "tmdb-pending") {
		return (
			<HomeTmdbCatalogueGrid>
				<TmdbLobbySkeleton />
			</HomeTmdbCatalogueGrid>
		);
	}

	return <>{children}</>;
}
