import { tmdbLogoUrlFromPath } from "@/lib/tmdb-logo-url";
import type { WatchlistProviderCatalogueEntry } from "@/lib/watchlist-provider-catalogue-types";

/** Standard TMDb provider artwork from the watchlist catalogue (not Logo.dev PNG wordmarks). */
export function watchlistPlatformRowLogoUrl(
	entry: Pick<WatchlistProviderCatalogueEntry, "logoPath">,
): string | null {
	return tmdbLogoUrlFromPath(entry.logoPath, "w154");
}

/** Same TMDb size as the row — sharper when cropped into stacked circles. */
export function watchlistPlatformPillLogoUrl(
	entry: Pick<WatchlistProviderCatalogueEntry, "logoPath">,
): string | null {
	return tmdbLogoUrlFromPath(entry.logoPath, "w154");
}
