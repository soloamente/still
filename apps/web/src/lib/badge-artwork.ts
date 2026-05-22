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

/**
 * Shared `next/image` class for `/badges/*.png` — `max-h` / `max-w` can scale one axis;
 * pairing with `h-auto w-auto` keeps aspect ratio and clears the dev console warning.
 */
export const BADGE_ARTWORK_IMAGE_CLASS =
	"h-auto w-auto max-h-full max-w-full object-contain";
