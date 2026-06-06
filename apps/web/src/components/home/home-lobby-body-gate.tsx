"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { CommunityLobbySkeleton } from "@/components/home/community-lobby-skeleton";
import { useHomeBrowseSurface } from "@/components/home/home-browse-surface-context";
import { HomeTmdbCatalogueGrid } from "@/components/home/home-tmdb-lobby-chrome";
import { TmdbLobbySkeleton } from "@/components/home/tmdb-lobby-skeleton";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import { resolveLobbyBodyGateMode } from "@/lib/home-lobby-body-gate-mode";

/**
 * Swaps catalogue body during optimistic browse-surface navigation so patrons
 * never stare at the wrong lobby (Movies grid while Community pill is active).
 */
export function HomeLobbyBodyGate({
	serverBrowse,
	children,
}: {
	/** Browse branch the current RSC payload rendered — frozen until navigation. */
	serverBrowse: HomeBrowseSurface;
	children: ReactNode;
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { activeBrowse, urlBrowse: clientUrlBrowse } = useHomeBrowseSurface();
	const { isPending, navigate } = useLobbyNavigation();
	const syncRequestedRef = useRef(false);

	const mode = resolveLobbyBodyGateMode({
		activeBrowse,
		clientUrlBrowse,
		serverBrowse,
		isPending,
	});

	// Session restore can move the client URL ahead of the server branch — pull RSC once.
	useEffect(() => {
		if (mode === "settled") {
			syncRequestedRef.current = false;
			return;
		}
		if (activeBrowse !== clientUrlBrowse || isPending) return;
		if (clientUrlBrowse === serverBrowse) return;
		if (syncRequestedRef.current) return;

		syncRequestedRef.current = true;
		const query = searchParams.toString();
		const href = query ? `${pathname}?${query}` : pathname;
		navigate(href);
	}, [
		activeBrowse,
		clientUrlBrowse,
		isPending,
		mode,
		navigate,
		pathname,
		searchParams,
		serverBrowse,
	]);

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
