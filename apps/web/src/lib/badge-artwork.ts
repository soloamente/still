/**
 * Full-badge artwork served from `apps/web/public/badges/`.
 * These assets include their own metal frame and label — render without tier heptagons.
 */
export const BADGE_ARTWORK = {
	firstLight: "/badges/light.png",
	reelOne: "/badges/10.png",
	curator: "/badges/curator.png",
	critic: "/badges/critic.png",
} as const;

export function isBadgeArtworkUrl(iconUrl: string | null | undefined): boolean {
	return Boolean(iconUrl?.startsWith("/badges/"));
}
