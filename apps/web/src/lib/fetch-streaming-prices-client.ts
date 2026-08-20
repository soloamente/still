import { stillApiOrigin } from "@/lib/still-api-origin";
import type { StreamingPricesResponse } from "@/lib/streaming-offer-prices";

/**
 * Client fetch for all-country rent/buy prices.
 * Returns null on network / 5xx so the Streaming tab keeps TMDb checkmarks.
 */
export async function fetchStreamingPricesClient(opts: {
	listingKind: "movie" | "tv";
	tmdbId: number;
	signal?: AbortSignal;
}): Promise<StreamingPricesResponse | null> {
	if (!Number.isFinite(opts.tmdbId) || opts.tmdbId <= 0) {
		return null;
	}

	const segment = opts.listingKind === "movie" ? "movies" : "tv";
	const url = new URL(
		`/api/${segment}/${opts.tmdbId}/streaming-prices`,
		stillApiOrigin(),
	);

	try {
		const res = await fetch(url, {
			credentials: "include",
			signal: opts.signal,
		});
		if (!res.ok) return null;
		return (await res.json()) as StreamingPricesResponse;
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") return null;
		if (err instanceof Error && err.name === "AbortError") return null;
		return null;
	}
}
