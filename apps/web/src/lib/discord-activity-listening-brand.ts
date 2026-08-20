import type { ProfileDiscordActivity } from "@/lib/fetch-profile-discord-activity-client";

/** Known listening integrations surfaced with a platform logo on profile activity. */
export type DiscordListeningBrand = "spotify" | "apple_music";

const SPOTIFY_SOURCE = "spotify";
const APPLE_MUSIC_SOURCE = "apple music";

/** Maps API `source` to a listening brand logo when applicable. */
export function resolveDiscordListeningBrand(
	activity: ProfileDiscordActivity,
): DiscordListeningBrand | null {
	if (activity.kind !== "listening") return null;

	const source = activity.source?.trim().toLowerCase() ?? "";
	if (source.includes(SPOTIFY_SOURCE)) return "spotify";
	if (source.includes(APPLE_MUSIC_SOURCE)) return "apple_music";

	return null;
}

/** Human-readable service name for tooltips and screen readers. */
export function discordListeningBrandLabel(
	brand: DiscordListeningBrand,
): string {
	switch (brand) {
		case "spotify":
			return "Spotify";
		case "apple_music":
			return "Apple Music";
		default: {
			const _exhaustive: never = brand;
			return _exhaustive;
		}
	}
}

/** Ambient wash + progress accent tokens per listening brand. */
export function discordListeningBrandTheme(brand: DiscordListeningBrand): {
	progressFillClassName: string;
	iconClassName: string;
} {
	switch (brand) {
		case "spotify":
			return {
				progressFillClassName: "bg-[#1DB954]",
				iconClassName: "text-[#1DB954]",
			};
		case "apple_music":
			return {
				progressFillClassName: "bg-[#FC4058]",
				iconClassName: "text-[#FC4058]",
			};
		default: {
			const _exhaustive: never = brand;
			return _exhaustive;
		}
	}
}
