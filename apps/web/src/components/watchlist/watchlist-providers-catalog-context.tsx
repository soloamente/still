"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import type {
	WatchlistProviderCatalogueEntry,
	WatchlistProvidersCatalogPayload,
} from "@/lib/watchlist-provider-catalogue-types";

const EMPTY: WatchlistProvidersCatalogPayload = {
	providers: [],
	region: null,
	needsRegion: true,
	failed: false,
};

const WatchlistProvidersCatalogContext =
	createContext<WatchlistProvidersCatalogPayload>(EMPTY);

/** Server-seeded provider catalogue for the platform row + composite pill. */
export function WatchlistProvidersCatalogProvider({
	payload,
	children,
}: {
	payload: WatchlistProvidersCatalogPayload;
	children: ReactNode;
}) {
	const value = useMemo(() => payload, [payload]);
	return (
		<WatchlistProvidersCatalogContext.Provider value={value}>
			{children}
		</WatchlistProvidersCatalogContext.Provider>
	);
}

export function useWatchlistProvidersCatalog(): WatchlistProvidersCatalogPayload {
	return useContext(WatchlistProvidersCatalogContext);
}

/** Resolve metadata for a selected id (deep links may reference providers not in the row). */
export function resolveWatchlistProviderEntry(
	catalogue: readonly WatchlistProviderCatalogueEntry[],
	providerId: number,
): WatchlistProviderCatalogueEntry {
	return (
		catalogue.find((entry) => entry.providerId === providerId) ?? {
			providerId,
			providerName: `Service ${providerId}`,
			logoPath: null,
			titleCount: 0,
		}
	);
}
