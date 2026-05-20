/**
 * ISO 3166-1 alpha-2 codes for TMDb `watch_region` — compact list for pickers
 * (Settings + first-run home prompt). “ALL” is handled separately in prefs/API.
 */
export const CATALOG_WATCH_REGION_OPTIONS: readonly {
	value: string;
	label: string;
}[] = [
	{ value: "US", label: "United States" },
	{ value: "GB", label: "United Kingdom" },
	{ value: "CA", label: "Canada" },
	{ value: "AU", label: "Australia" },
	{ value: "DE", label: "Germany" },
	{ value: "FR", label: "France" },
	{ value: "IT", label: "Italy" },
	{ value: "ES", label: "Spain" },
	{ value: "NL", label: "Netherlands" },
	{ value: "JP", label: "Japan" },
	{ value: "KR", label: "South Korea" },
	{ value: "BR", label: "Brazil" },
	{ value: "MX", label: "Mexico" },
	{ value: "IN", label: "India" },
	{ value: "SE", label: "Sweden" },
	{ value: "NO", label: "Norway" },
	{ value: "DK", label: "Denmark" },
	{ value: "FI", label: "Finland" },
	{ value: "IE", label: "Ireland" },
	{ value: "NZ", label: "New Zealand" },
	{ value: "PL", label: "Poland" },
	{ value: "PT", label: "Portugal" },
	{ value: "AT", label: "Austria" },
	{ value: "CH", label: "Switzerland" },
	{ value: "BE", label: "Belgium" },
] as const;
