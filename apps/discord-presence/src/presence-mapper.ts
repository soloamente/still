/**
 * Local duplicate of Lanyard `GET /v1/users/:id` `data` used by Elysia
 * `formatDiscordActivity`. Kept in the Worker so we never import `apps/server`
 * or `@still/*`.
 */

import { emptyPresence } from "./empty-presence";

export type LanyardActivityTimestampsPayload = {
	start?: number | null;
	end?: number | null;
};

export type LanyardSpotifyPayload = {
	song?: string | null;
	artist?: string | null;
	album?: string | null;
	album_art_url?: string | null;
	timestamps?: LanyardActivityTimestampsPayload | null;
};

export type LanyardActivityAssetsPayload = {
	large_image?: string | null;
	large_text?: string | null;
	large_url?: string | null;
	small_image?: string | null;
	small_text?: string | null;
	small_url?: string | null;
};

export type LanyardActivityPayload = {
	type?: number;
	name?: string | null;
	details?: string | null;
	state?: string | null;
	emoji?: { name?: string | null } | null;
	assets?: LanyardActivityAssetsPayload | null;
	timestamps?: LanyardActivityTimestampsPayload | null;
};

export type LanyardPresencePayload = {
	listening_to_spotify?: boolean;
	spotify?: LanyardSpotifyPayload | null;
	activities?: LanyardActivityPayload[] | null;
	discord_status?: string | null;
};

export type DiscordPresenceSnapshot = {
	user?: { id?: string };
	status?: string | null;
	activities?: DiscordActivity[] | null;
};

export type DiscordActivity = {
	type?: number;
	name?: string | null;
	details?: string | null;
	state?: string | null;
	assets?: {
		large_image?: string | null;
		large_text?: string | null;
		small_image?: string | null;
		small_text?: string | null;
	} | null;
	timestamps?: { start?: number | null; end?: number | null } | null;
};

const DISCORD_ACTIVITY_LISTENING = 2;
const SPOTIFY_ACTIVITY_NAME = "Spotify";

/**
 * Resolve Discord activity art into a browser-loadable URL for `album_art_url`.
 * - `spotify:{id}` is Discord's Spotify CDN key → `https://i.scdn.co/image/{id}`
 * - `mp:external/{hash}/https/...` unwraps to `https://...`
 * - already-`https://` URLs pass through
 */
function resolveAlbumArtUrl(value: string | null | undefined): string | null {
	if (typeof value !== "string") return null;
	const image = value.trim();
	if (image.length === 0) return null;
	if (image.startsWith("https://")) return image;

	const spotifyMatch = image.match(/^spotify:(.+)$/);
	if (spotifyMatch?.[1]) {
		return `https://i.scdn.co/image/${spotifyMatch[1]}`;
	}

	const mpExternalMatch = image.match(/^mp:external\/[^/]+\/(https\/.+)$/);
	if (mpExternalMatch?.[1]) {
		return mpExternalMatch[1].replace(/^https\//, "https://");
	}

	return null;
}

function copyActivity(activity: DiscordActivity): LanyardActivityPayload {
	return {
		type: activity.type,
		name: activity.name,
		details: activity.details,
		state: activity.state,
		assets: activity.assets
			? {
					large_image: activity.assets.large_image,
					large_text: activity.assets.large_text,
					small_image: activity.assets.small_image,
					small_text: activity.assets.small_text,
				}
			: activity.assets,
		timestamps: activity.timestamps
			? {
					start: activity.timestamps.start,
					end: activity.timestamps.end,
				}
			: activity.timestamps,
	};
}

function isSpotifyActivity(activity: DiscordActivity): boolean {
	return (
		activity.type === DISCORD_ACTIVITY_LISTENING &&
		activity.name === SPOTIFY_ACTIVITY_NAME
	);
}

function toSpotifyPayload(activity: DiscordActivity): LanyardSpotifyPayload {
	return {
		song: activity.details ?? null,
		artist: activity.state ?? null,
		album: activity.assets?.large_text ?? null,
		album_art_url: resolveAlbumArtUrl(activity.assets?.large_image),
		timestamps: activity.timestamps ?? null,
	};
}

export function toLanyardPresence(
	snapshot: DiscordPresenceSnapshot | null | undefined,
): LanyardPresencePayload {
	if (snapshot == null) {
		return emptyPresence();
	}

	const discordStatus = snapshot.status ?? "offline";
	if (discordStatus === "offline") {
		return emptyPresence("offline");
	}

	const rawActivities = snapshot.activities ?? [];
	if (rawActivities.length === 0) {
		return emptyPresence(discordStatus);
	}

	const activities = rawActivities.map(copyActivity);
	const spotifyActivity = rawActivities.find(isSpotifyActivity);

	if (!spotifyActivity) {
		return {
			discord_status: discordStatus,
			activities,
			listening_to_spotify: false,
			spotify: null,
		};
	}

	return {
		discord_status: discordStatus,
		activities,
		listening_to_spotify: true,
		spotify: toSpotifyPayload(spotifyActivity),
	};
}
