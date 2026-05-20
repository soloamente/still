import { isBadgeArtworkUrl } from "@/lib/badge-artwork";

/** Fallback map for badge notifications created before `iconUrl` was stored on the row. */
const BADGE_ID_TO_ARTWORK: Record<string, string> = {
	watch_1: "/badges/light.png",
	watch_10: "/badges/10.png",
	cur_1l: "/badges/curator.png",
	rev_1: "/badges/critic.png",
};

/** Resolve `/badges/*.png` for a `badge.awarded` notification payload. */
export function resolveNotificationBadgeIconUrl(
	payload: Record<string, unknown>,
): string | null {
	const fromPayload = payload.iconUrl;
	if (typeof fromPayload === "string" && isBadgeArtworkUrl(fromPayload)) {
		return fromPayload;
	}
	const badgeId = payload.badgeId;
	if (typeof badgeId !== "string") return null;
	const mapped = BADGE_ID_TO_ARTWORK[badgeId];
	return mapped && isBadgeArtworkUrl(mapped) ? mapped : null;
}
