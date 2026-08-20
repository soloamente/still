import { env } from "@still/env/server";

import { cacheRedis } from "./redis-cache";

const DEFAULT_DIRECT_BASE = "https://api.movieofthenight.com/v4";
const RAPIDAPI_HOST = "streaming-availability.p.rapidapi.com";
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`;

/** Redis TTL — prices move slowly; miss cost is a paid upstream call. */
const CACHE_TTL_SEC = 60 * 60 * 12;
/** Shorter TTL when the show/region has no priced offers (or 404). */
const EMPTY_CACHE_TTL_SEC = 60 * 60;

export type StreamingListingKind = "movie" | "tv";

export type StreamingOfferPrice = {
	amount: number;
	currency: string;
	formatted: string;
	quality: string | null;
};

export type StreamingServicePrices = {
	serviceId: string;
	serviceName: string;
	/** Normalized key for matching TMDb provider names. */
	nameKey: string;
	rent: StreamingOfferPrice | null;
	buy: StreamingOfferPrice | null;
};

export type StreamingPricesPayload = {
	configured: boolean;
	/** ISO 3166-1 alpha-2 (uppercase) → priced services in that country. */
	offersByCountry: Record<string, StreamingServicePrices[]>;
};

type RawPrice = {
	amount?: string;
	currency?: string;
	formatted?: string;
};

type RawStreamingOption = {
	service?: { id?: string; name?: string };
	type?: string;
	quality?: string;
	price?: RawPrice | null;
};

type RawShow = {
	streamingOptions?: Record<string, RawStreamingOption[] | undefined>;
};

/** Feature switch — no key means Streaming tab keeps TMDb checkmarks only. */
export function isStreamingAvailabilityConfigured(): boolean {
	return Boolean(env.STREAMING_AVAILABILITY_API_KEY?.trim());
}

function resolveBaseUrl(): string {
	const fromEnv = env.STREAMING_AVAILABILITY_BASE_URL?.trim();
	if (fromEnv) return fromEnv.replace(/\/$/, "");
	return DEFAULT_DIRECT_BASE;
}

function isRapidApiBase(baseUrl: string): boolean {
	return baseUrl.includes("rapidapi.com");
}

/** Collapse provider labels so “Apple TV” ≈ “Apple iTunes” ≈ service id `apple`. */
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

function parseAmount(raw: string | undefined): number | null {
	if (raw == null || raw === "") return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

/**
 * Storefront amount with a currency **symbol** (A$24.99), not a code suffix
 * (24.99 AUD) — denser for the Streaming table columns.
 */
export function formatStreamingPriceAmount(
	amount: number,
	currency: string,
): string {
	const code = currency.trim().toUpperCase();
	if (!code) return String(amount);
	try {
		return new Intl.NumberFormat("en", {
			style: "currency",
			currency: code,
			currencyDisplay: "symbol",
		}).format(amount);
	} catch {
		return `${amount} ${code}`;
	}
}

/**
 * Prefer the lowest **HD** rent/buy SKU; if none, prefer HD-class (qhd/uhd)
 * over SD; otherwise cheapest any quality.
 */
export function pickLowestHdPrice(
	candidates: Array<{
		amount: number;
		currency: string;
		formatted: string;
		quality: string | null;
	}>,
): StreamingOfferPrice | null {
	if (candidates.length === 0) return null;

	const byAmount = (
		a: (typeof candidates)[number],
		b: (typeof candidates)[number],
	) => a.amount - b.amount;

	const hd = candidates.filter((c) => c.quality === "hd");
	if (hd.length) return [...hd].sort(byAmount)[0] ?? null;

	const hdClass = candidates.filter(
		(c) => c.quality === "qhd" || c.quality === "uhd",
	);
	if (hdClass.length) return [...hdClass].sort(byAmount)[0] ?? null;

	return [...candidates].sort(byAmount)[0] ?? null;
}

function collectTypedPrices(
	options: RawStreamingOption[],
	type: "rent" | "buy",
): StreamingOfferPrice | null {
	const candidates: Array<{
		amount: number;
		currency: string;
		formatted: string;
		quality: string | null;
	}> = [];

	for (const opt of options) {
		if (opt.type !== type) continue;
		const amount = parseAmount(opt.price?.amount);
		const currency = opt.price?.currency?.trim();
		if (amount == null || !currency) continue;
		candidates.push({
			amount,
			currency,
			// Prefer symbol formatting over upstream "9.99 USD" / "24.99 AUD" strings.
			formatted: formatStreamingPriceAmount(amount, currency),
			quality: opt.quality?.trim().toLowerCase() || null,
		});
	}

	return pickLowestHdPrice(candidates);
}

/** Pure mapper — unit-tested without network. */
export function mapShowToServicePrices(
	show: RawShow,
	region: string,
): StreamingServicePrices[] {
	const countryKey = region.trim().toLowerCase();
	const options = show.streamingOptions?.[countryKey] ?? [];
	if (!options.length) return [];

	const byService = new Map<string, RawStreamingOption[]>();
	for (const opt of options) {
		const serviceId = opt.service?.id?.trim();
		if (!serviceId) continue;
		const list = byService.get(serviceId) ?? [];
		list.push(opt);
		byService.set(serviceId, list);
	}

	const offers: StreamingServicePrices[] = [];
	for (const [serviceId, serviceOptions] of byService) {
		const serviceName = serviceOptions[0]?.service?.name?.trim() || serviceId;
		const rent = collectTypedPrices(serviceOptions, "rent");
		const buy = collectTypedPrices(serviceOptions, "buy");
		if (!rent && !buy) continue;
		offers.push({
			serviceId,
			serviceName,
			nameKey:
				normalizeStreamingServiceKey(serviceName) ||
				normalizeStreamingServiceKey(serviceId),
			rent,
			buy,
		});
	}

	offers.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
	return offers;
}

/** Map every country in a show payload to priced rent/buy rows. */
export function mapShowToOffersByCountry(
	show: RawShow,
): Record<string, StreamingServicePrices[]> {
	const out: Record<string, StreamingServicePrices[]> = {};
	for (const countryKey of Object.keys(show.streamingOptions ?? {})) {
		const offers = mapShowToServicePrices(show, countryKey);
		if (offers.length === 0) continue;
		out[countryKey.trim().toUpperCase()] = offers;
	}
	return out;
}

async function fetchShowFromUpstream(opts: {
	listingKind: StreamingListingKind;
	tmdbId: number;
}): Promise<RawShow | null> {
	const apiKey = env.STREAMING_AVAILABILITY_API_KEY?.trim();
	if (!apiKey) return null;

	const base = resolveBaseUrl();
	const idPath =
		opts.listingKind === "movie" ? `movie/${opts.tmdbId}` : `tv/${opts.tmdbId}`;
	const url = new URL(`${base}/shows/${idPath}`);
	// Omit `country` so one call returns every region’s rent/buy prices.
	url.searchParams.set("output_language", "en");

	const headers: Record<string, string> = {};
	if (isRapidApiBase(base)) {
		// RapidAPI rejects duplicate key header casings with 403 "not subscribed".
		// Match the dashboard snippet exactly — one key + one host header.
		headers["x-rapidapi-key"] = apiKey;
		headers["x-rapidapi-host"] = RAPIDAPI_HOST;
		headers["Content-Type"] = "application/json";
	} else {
		headers.Accept = "application/json";
		headers["X-Api-Key"] = apiKey;
	}

	const res = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(12_000),
	});
	if (res.status === 404) return { streamingOptions: {} };
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		console.error(
			"[streaming-availability] show fetch failed",
			res.status,
			body.slice(0, 200),
		);
		// Null = transient upstream failure — caller must not Redis-cache this.
		return null;
	}
	return (await res.json()) as RawShow;
}

/**
 * All-country rent/buy prices for a TMDb listing. Empty map when unconfigured;
 * never throws for missing keys.
 */
export async function resolveStreamingPrices(opts: {
	listingKind: StreamingListingKind;
	tmdbId: number;
}): Promise<StreamingPricesPayload> {
	if (!isStreamingAvailabilityConfigured()) {
		return { configured: false, offersByCountry: {} };
	}

	// v4 — symbol-formatted prices (A$24.99), not code suffixes (24.99 AUD).
	const cacheKey = `sense:streaming-prices:v4:${opts.listingKind}:${opts.tmdbId}`;
	const redis = await cacheRedis();

	if (redis) {
		try {
			const cached =
				await redis.get<Record<string, StreamingServicePrices[]>>(cacheKey);
			if (cached !== null && cached !== undefined) {
				return { configured: true, offersByCountry: cached };
			}
		} catch {
			// Cache read failed — fall through to upstream.
		}
	}

	const show = await fetchShowFromUpstream({
		listingKind: opts.listingKind,
		tmdbId: opts.tmdbId,
	});
	// Upstream error — empty for this request only (do not poison Redis).
	if (show === null) {
		return { configured: true, offersByCountry: {} };
	}

	const offersByCountry = mapShowToOffersByCountry(show);
	if (redis) {
		try {
			const countryCount = Object.keys(offersByCountry).length;
			await redis.set(cacheKey, offersByCountry, {
				ex: countryCount > 0 ? CACHE_TTL_SEC : EMPTY_CACHE_TTL_SEC,
			});
		} catch {
			// Best-effort cache write.
		}
	}

	return { configured: true, offersByCountry };
}

/** Test helper — RapidAPI vs direct header choice. */
export function streamingAvailabilityAuthModeForTests(
	baseUrl: string,
): "rapidapi" | "direct" {
	return isRapidApiBase(baseUrl) ? "rapidapi" : "direct";
}

export { DEFAULT_DIRECT_BASE, RAPIDAPI_BASE };
