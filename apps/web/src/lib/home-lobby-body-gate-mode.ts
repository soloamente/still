import type { HomeBrowseSurface } from "@/lib/home-browse-surface";

export type LobbyBodyGateMode =
	| "community-pending"
	| "tmdb-pending"
	| "settled";

/**
 * Decides which catalogue body to show during optimistic browse taps and when the
 * client URL has moved ahead of the frozen RSC branch (session restore race).
 */
export function resolveLobbyBodyGateMode(input: {
	activeBrowse: HomeBrowseSurface;
	clientUrlBrowse: HomeBrowseSurface;
	serverBrowse: HomeBrowseSurface;
}): LobbyBodyGateMode {
	const { activeBrowse, clientUrlBrowse, serverBrowse } = input;

	// Optimistic pill ahead of settled URL (browse tap in flight).
	if (activeBrowse !== clientUrlBrowse) {
		return activeBrowse === "community" ? "community-pending" : "tmdb-pending";
	}

	// Sort / venue / run / filter changes stay on the same browse branch — keep
	// chips mounted and let HomeTmdbCatalogueGrid dim the poster grid while RSC
	// catches up (isPending alone must not swap the whole lobby for a skeleton).

	// Client URL settled but RSC still on the previous browse branch.
	if (clientUrlBrowse !== serverBrowse) {
		return clientUrlBrowse === "community"
			? "community-pending"
			: "tmdb-pending";
	}

	return "settled";
}
