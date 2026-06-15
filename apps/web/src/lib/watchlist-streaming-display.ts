/** Watchlist lobby pill when a title has flatrate providers in the patron region. */
export function formatWatchlistStreamingPill(providerName: string): string {
	const name = providerName.trim();
	return name ? `Now on ${name}` : "";
}
