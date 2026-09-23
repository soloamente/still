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

/**
 * Attuned preview body — the count is saves not streaming in the chosen region,
 * which is named when known ("…aren't streaming in Italy yet").
 */
export function watchlistAlertPreviewBodyCopy(
	count: number,
	region?: string | null,
): string {
	if (count <= 0) {
		return "Attuned tells you the day your saved titles land on your services.";
	}
	const where = region ? ` in ${watchlistRegionLabel(region)}` : "";
	return count === 1
		? `1 of your saved titles isn't streaming${where} yet — Attuned tells you the day it lands.`
		: `${count} of your saved titles aren't streaming${where} yet — Attuned tells you the day they land.`;
}

export type WatchlistAlertPreviewPoster = {
	listingKind: "movie" | "tv";
	tmdbId: number;
	title: string;
	/** Absolute poster URL (or null → no-poster placeholder). */
	posterUrl: string | null;
};

/** Preview posters: the tapped title first, then server samples, de-duped, max 3. */
export function watchlistAlertPreviewPosters(
	tapped: WatchlistAlertPreviewPoster | null | undefined,
	sample: readonly WatchlistAlertPreviewPoster[],
): WatchlistAlertPreviewPoster[] {
	const seen = new Set<string>();
	const out: WatchlistAlertPreviewPoster[] = [];
	for (const poster of tapped ? [tapped, ...sample] : sample) {
		const key = `${poster.listingKind}:${poster.tmdbId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(poster);
		if (out.length === 3) break;
	}
	return out;
}
