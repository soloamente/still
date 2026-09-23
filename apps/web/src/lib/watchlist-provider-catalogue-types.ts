/** Row in the watchlist platform logo rail — mirrors `GET /api/watchlist/providers`. */
export type WatchlistProviderCatalogueEntry = {
	providerId: number;
	providerName: string;
	logoPath: string | null;
	titleCount: number;
};

export type WatchlistProvidersCatalogPayload = {
	providers: WatchlistProviderCatalogueEntry[];
	/** Region signal from API — ISO code, `"ALL"`, or null when unset. */
	region: string | null;
	needsRegion: boolean;
	failed: boolean;
};
