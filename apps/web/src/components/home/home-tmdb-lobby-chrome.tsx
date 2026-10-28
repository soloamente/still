"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { HomeTmdbLobbyParamsProvider } from "@/components/home/home-tmdb-lobby-params-context";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import { useHydrated } from "@/lib/use-hydrated";

/** Provider stack for `/home` Movies·TV chrome + catalogue grid. */
export function HomeTmdbLobbyChrome({ children }: { children: ReactNode }) {
	return <HomeTmdbLobbyParamsProvider>{children}</HomeTmdbLobbyParamsProvider>;
}

/** TMDb poster grid — smooth dim pulse on stale rows while the next RSC payload loads. */
export function HomeTmdbCatalogueGrid({ children }: { children: ReactNode }) {
	const { isPending: navigationPending } = useLobbyNavigation();
	// `HomeLobbySessionRestore` starts a transition in a layout effect on mount,
	// and this grid sits in a Suspense boundary that hydrates later — so
	// `isPending` can already be true on the first client render while the server
	// HTML says false. Only reflect it once hydrated; the dim pulse then appears
	// one commit later instead of mismatching.
	const hydrated = useHydrated();
	const isPending = hydrated && navigationPending;

	return (
		<div className="relative flex flex-col" aria-busy={isPending}>
			<div className={cn(isPending && "lobby-grid-dim-pulse")}>{children}</div>
		</div>
	);
}
