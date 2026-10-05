import { loadPatronPreferences } from "./patron-preferences";
import { parseWatchlistProviderIds } from "./watchlist-provider-filter";
import { readCatalogWatchRegionPrefOrNull } from "./watchlist-streaming-alerts";

/** Resolved TMDb discover knobs when a streaming platform filter is active. */
export type DiscoverStreamingProviderScope = {
	providerIds: number[];
	withWatchMonetizationTypes: string | undefined;
	watchRegion: string | undefined;
	watchRegionAll: boolean;
	/** Movie discover: digital release type when filtering flatrate at home. */
	withReleaseTypes: string | undefined;
};

/**
 * When `?providers=` is set, force flatrate discover in the patron watch region
 * (Settings → Catalogue) unless the client overrides `watch_region`.
 */
export async function resolveDiscoverStreamingProviderScope(input: {
	providersRaw: string | undefined | null;
	queryWatchRegion: string | undefined | null;
	userId: string | undefined;
	envDefaultRegion: string;
}): Promise<DiscoverStreamingProviderScope> {
	const providerIds = parseWatchlistProviderIds(
		input.providersRaw ?? undefined,
	);
	if (providerIds.length === 0) {
		return {
			providerIds: [],
			withWatchMonetizationTypes: undefined,
			watchRegion: undefined,
			watchRegionAll: false,
			withReleaseTypes: undefined,
		};
	}

	const prefs =
		input.userId != null ? await loadPatronPreferences(input.userId) : null;

	const regionRaw = (input.queryWatchRegion ?? "").trim().toUpperCase();
	const prefAll = readCatalogWatchRegionPrefOrNull(prefs) === "ALL";
	const watchRegionAll =
		prefAll ||
		regionRaw === "ALL" ||
		regionRaw === "ANY" ||
		regionRaw === "WORLD";
	const watchRegionFromQuery =
		!watchRegionAll && regionRaw.length === 2 && /^[A-Z]{2}$/.test(regionRaw)
			? regionRaw
			: undefined;

	const chosenPref = readCatalogWatchRegionPrefOrNull(prefs);
	const prefRegion =
		chosenPref != null && chosenPref !== "ALL" ? chosenPref : undefined;

	const envDefault = input.envDefaultRegion.trim().toUpperCase();
	const watchRegionDefault =
		envDefault.length === 2 && /^[A-Z]{2}$/.test(envDefault)
			? envDefault
			: "US";

	const watchRegion = watchRegionAll
		? undefined
		: (watchRegionFromQuery ?? prefRegion ?? watchRegionDefault);

	return {
		providerIds,
		withWatchMonetizationTypes: "flatrate",
		watchRegion,
		watchRegionAll,
		withReleaseTypes: "4",
	};
}

/** ISO code used to hydrate the platform rail when patron pref is unset. */
export function searchDialogStreamingProvidersListingRegion(
	userId: string | undefined,
	prefs: Record<string, unknown> | null,
	envDefaultRegion: string,
): { region: string | null; needsRegion: boolean; listingRegion: string } {
	const chosen = readCatalogWatchRegionPrefOrNull(prefs);
	const envDefault = envDefaultRegion.trim().toUpperCase();
	const fallback =
		envDefault.length === 2 && /^[A-Z]{2}$/.test(envDefault)
			? envDefault
			: "US";

	if (userId != null && chosen == null) {
		return { region: null, needsRegion: true, listingRegion: fallback };
	}

	if (chosen === "ALL") {
		return { region: "ALL", needsRegion: false, listingRegion: fallback };
	}

	const iso = chosen ?? fallback;
	return { region: iso, needsRegion: false, listingRegion: iso };
}
