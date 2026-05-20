import { CATALOG_WATCH_REGION_OPTIONS } from "@/lib/catalog-watch-region-options";

/** Minimal TMDb watch-provider row from movie/TV detail `append_to_response`. */
export type TmdbWatchProviderRow = {
	provider_id: number;
	provider_name: string;
	logo_path: string;
	display_priority?: number;
};

export type TmdbWatchProvidersByCountry = Record<
	string,
	{
		link?: string;
		flatrate?: TmdbWatchProviderRow[];
		rent?: TmdbWatchProviderRow[];
		buy?: TmdbWatchProviderRow[];
	}
>;

export type MovieWatchProviderSummary = {
	id: number;
	name: string;
	logoPath: string;
	countryCount: number;
};

export type MovieWatchProviderCountryRow = {
	countryCode: string;
	countryName: string;
	link: string | null;
	rent: boolean;
	buy: boolean;
	flatrate: boolean;
};

export type MovieWatchProvidersViewModel = {
	providers: MovieWatchProviderSummary[];
	rowsByProviderId: Record<number, MovieWatchProviderCountryRow[]>;
};

const COUNTRY_LABEL_BY_CODE = new Map(
	CATALOG_WATCH_REGION_OPTIONS.map((o) => [o.value, o.label]),
);

/** Full English region names for any ISO 3166-1 alpha-2 code TMDb returns (not just catalogue prefs). */
const REGION_DISPLAY_NAMES =
	typeof Intl !== "undefined"
		? new Intl.DisplayNames(["en"], { type: "region" })
		: null;

function countryLabel(code: string): string {
	const normalized = code.trim().toUpperCase();
	if (normalized.length !== 2) return code;

	// Keep catalogue picker labels aligned with Settings / home region names.
	const fromCatalog = COUNTRY_LABEL_BY_CODE.get(normalized);
	if (fromCatalog) return fromCatalog;

	const fromIntl = REGION_DISPLAY_NAMES?.of(normalized);
	if (fromIntl && fromIntl !== normalized) return fromIntl;

	return normalized;
}

function hasProvider(
	list: TmdbWatchProviderRow[] | undefined,
	providerId: number,
): boolean {
	return list?.some((p) => p.provider_id === providerId) ?? false;
}

/**
 * Groups TMDb `watch/providers` by service, then by country — powers the detail
 * Streaming tab (provider picker + country rent/buy table). TMDb does not expose prices.
 */
export function buildMovieWatchProvidersViewModel(
	results: TmdbWatchProvidersByCountry | undefined,
): MovieWatchProvidersViewModel {
	if (!results || Object.keys(results).length === 0) {
		return { providers: [], rowsByProviderId: {} };
	}

	const providerMeta = new Map<
		number,
		{ name: string; logoPath: string; countries: Set<string> }
	>();
	const rowsByProviderId: Record<number, MovieWatchProviderCountryRow[]> = {};

	for (const [countryCode, country] of Object.entries(results)) {
		const allInCountry = [
			...(country.flatrate ?? []),
			...(country.rent ?? []),
			...(country.buy ?? []),
		];

		for (const p of allInCountry) {
			const existing = providerMeta.get(p.provider_id);
			if (existing) {
				existing.countries.add(countryCode);
				if (!existing.logoPath && p.logo_path) existing.logoPath = p.logo_path;
			} else {
				providerMeta.set(p.provider_id, {
					name: p.provider_name,
					logoPath: p.logo_path,
					countries: new Set([countryCode]),
				});
			}
		}
	}

	for (const [providerId, meta] of providerMeta) {
		const rows: MovieWatchProviderCountryRow[] = [];

		for (const countryCode of meta.countries) {
			const country = results[countryCode];
			if (!country) continue;

			const rent = hasProvider(country.rent, providerId);
			const buy = hasProvider(country.buy, providerId);
			const flatrate = hasProvider(country.flatrate, providerId);
			if (!rent && !buy && !flatrate) continue;

			rows.push({
				countryCode,
				countryName: countryLabel(countryCode),
				link: country.link ?? null,
				rent,
				buy,
				flatrate,
			});
		}

		rows.sort((a, b) => a.countryName.localeCompare(b.countryName));
		rowsByProviderId[providerId] = rows;
	}

	const providers = [...providerMeta.entries()]
		.map(([id, meta]) => ({
			id,
			name: meta.name,
			logoPath: meta.logoPath,
			countryCount: meta.countries.size,
		}))
		.sort(
			(a, b) => b.countryCount - a.countryCount || a.name.localeCompare(b.name),
		);

	return { providers, rowsByProviderId };
}
