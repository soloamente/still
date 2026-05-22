import { discoverSearchParamsToHomeHref } from "@/lib/discover-catalog-url";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import { tvDiscoverSearchParamsToHomeHref } from "@/lib/tv-discover-catalog-url";

/**
 * Maps retired standalone catalogue routes to the canonical `/home` lobby.
 * Used by `proxy.ts` for bookmarks and external links after Tier A/B page removal.
 */
export function retiredCatalogueRedirectUrl(
	pathname: string,
	search: string,
): string | null {
	if (pathname === "/search" || pathname.startsWith("/search/")) {
		return "/home";
	}

	if (pathname === "/movies/popular") {
		return buildHomeLobbyHref({ browse: "movies", sort: "popular" });
	}

	if (pathname === "/movies/now-playing") {
		return buildHomeLobbyHref({
			browse: "movies",
			sort: "popular",
			venue: "theaters",
		});
	}

	if (pathname === "/movies/upcoming") {
		const venueRaw = new URLSearchParams(search)
			.get("venue")
			?.trim()
			.toLowerCase();
		const venue =
			venueRaw === "streaming" ? ("streaming" as const) : ("theaters" as const);
		return buildHomeLobbyHref({
			browse: "movies",
			sort: "upcoming",
			venue,
		});
	}

	if (
		pathname === "/movies/discover" ||
		pathname.startsWith("/movies/discover")
	) {
		return discoverSearchParamsToHomeHref(new URLSearchParams(search));
	}

	if (pathname === "/tv/on-the-air" || pathname.startsWith("/tv/on-the-air")) {
		return buildHomeLobbyHref({
			browse: "tv",
			sort: "popular",
			run: "ongoing",
		});
	}

	if (pathname === "/tv/discover" || pathname.startsWith("/tv/discover")) {
		return tvDiscoverSearchParamsToHomeHref(new URLSearchParams(search));
	}

	return null;
}
