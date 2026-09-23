/** Watchlist lobby pill when a title has flatrate providers in the patron region. */
export function formatWatchlistStreamingPill(providerName: string): string {
	const name = providerName.trim();
	return name ? `Now on ${name}` : "";
}

/** English country name for an ISO alpha-2 region; falls back to the code. */
export function watchlistRegionLabel(region: string): string {
	const code = region.trim().toUpperCase();
	try {
		return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
	} catch {
		// Invalid codes throw `RangeError` — the code itself still reads fine.
		return code;
	}
}

/** Success toast after enabling a streaming alert — names the region it watches. */
export function watchlistAlertOnToastCopy(
	region: string | null | undefined,
): string {
	return region
		? `We'll tell you when it streams in ${watchlistRegionLabel(region)}`
		: "We'll tell you when it streams";
}

/** Attuned preview body — the count is saves not streaming in the chosen region. */
export function watchlistAlertPreviewBodyCopy(count: number): string {
	if (count <= 0) {
		return "Attuned tells you the day your saved titles land on your services.";
	}
	return count === 1
		? "1 of your saved titles isn't streaming yet — Attuned tells you the day it lands."
		: `${count} of your saved titles aren't streaming yet — Attuned tells you the day they land.`;
}
