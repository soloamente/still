"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { HomeTmdbLobbyParamsProvider } from "@/components/home/home-tmdb-lobby-params-context";
import {
	LobbyNavigationProvider,
	useLobbyNavigation,
} from "@/components/lobby/lobby-navigation-provider";

/** Provider stack for `/home` Movies·TV chrome + catalogue grid. */
export function HomeTmdbLobbyChrome({ children }: { children: ReactNode }) {
	return (
		<LobbyNavigationProvider>
			<HomeTmdbLobbyParamsProvider>{children}</HomeTmdbLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}

/** TMDb poster grid — smooth dim pulse on stale rows while the next RSC payload loads. */
export function HomeTmdbCatalogueGrid({ children }: { children: ReactNode }) {
	const { isPending } = useLobbyNavigation();

	return (
		<div className="relative flex flex-col" aria-busy={isPending}>
			<div className={cn(isPending && "lobby-grid-dim-pulse")}>{children}</div>
		</div>
	);
}
