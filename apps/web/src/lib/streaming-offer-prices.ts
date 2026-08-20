/** Client-side mirror of server Streaming Availability offer rows. */
export type StreamingOfferPrice = {
	amount: number;
	currency: string;
	formatted: string;
	quality: string | null;
};

export type StreamingServicePrices = {
	serviceId: string;
	serviceName: string;
	nameKey: string;
	rent: StreamingOfferPrice | null;
	buy: StreamingOfferPrice | null;
};

export type StreamingPricesResponse = {
	configured: boolean;
	/** ISO2 uppercase → priced services. */
	offersByCountry: Record<string, StreamingServicePrices[]>;
};

/** Same aliases as `apps/server/src/lib/streaming-availability-prices.ts`. */
export function normalizeStreamingServiceKey(name: string): string {
	const raw = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
	if (!raw) return "";

	const aliases: Record<string, string> = {
		itunes: "apple",
		appleitunes: "apple",
		appletv: "apple",
		appletvplus: "apple",
		appletvstore: "apple",
		amazonprimevideo: "prime",
		amazonvideo: "prime",
		primevideo: "prime",
		amazon: "prime",
		googleplaymovies: "google",
		googleplay: "google",
		youtubepurchaserent: "google",
		youtube: "google",
		disneyplus: "disney",
		hbomax: "max",
		hbo: "max",
		hbomaxamazonchannel: "max",
		paramountplus: "paramount",
		microsoftstore: "microsoft",
		vudu: "fandango",
		fandangotheaterentals: "fandango",
		fandangoathome: "fandango",
	};
	return aliases[raw] ?? raw;
}

/** Look up priced offers for a TMDb provider label. */
export function findStreamingPricesForProvider(
	offers: StreamingServicePrices[],
	providerName: string,
): StreamingServicePrices | null {
	const key = normalizeStreamingServiceKey(providerName);
	if (!key) return null;
	return (
		offers.find(
			(o) =>
				o.nameKey === key ||
				normalizeStreamingServiceKey(o.serviceId) === key ||
				normalizeStreamingServiceKey(o.serviceName) === key,
		) ?? null
	);
}
