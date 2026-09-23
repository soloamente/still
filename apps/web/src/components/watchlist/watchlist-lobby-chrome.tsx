import { cache } from "react";

import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { WatchlistLobbyDisplayPrefsHydrator } from "@/components/watchlist/watchlist-lobby-display-prefs";
import { authServer } from "@/lib/auth-server";
import type { MeProfile } from "@/lib/fetch-me-profile";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";

/**
 * Session + profile for the watchlist chrome. Hover prefs hydrate the poster
 * wall from this boundary so `?order=` RSC does not wait on `profiles.me`.
 */
export const loadWatchlistChromeContext = cache(async () => {
	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));

	const profileData = profileRes.data as Exclude<MeProfile, null> | null;

	const mePrefs = profileData?.preferences ?? null;
	const stickyUser = buildPatronNavUserOrNull(session, profileData);

	return {
		signedIn: Boolean(session),
		stickyUser,
		monochromePeersOnHover: readCatalogMonochromePeersOnHoverPref(mePrefs),
		needsCatalogWatchRegionPrompt: Boolean(
			session && readCatalogTmdbWatchRegionPref(mePrefs) === null,
		),
	};
});

/** Sticky header — streams in with no skeleton (no second "UI" loader). */
export async function WatchlistChrome() {
	const {
		stickyUser,
		signedIn,
		needsCatalogWatchRegionPrompt,
		monochromePeersOnHover,
	} = await loadWatchlistChromeContext();
	return (
		<>
			<WatchlistLobbyDisplayPrefsHydrator
				monochromePeersOnHover={monochromePeersOnHover}
				signedIn={signedIn}
			/>
			<HomeStickyChrome user={stickyUser} />
			{signedIn ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</>
	);
}
