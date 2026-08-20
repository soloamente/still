/** Subset of Lanyard `GET /v1/users/:id` `data` used for profile activity copy. */
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

export type DiscordActivityKind =
	| "listening"
	| "playing"
	| "streaming"
	| "watching";

/** Live track progress when Discord exposes start/end timestamps (ms). */
export type DiscordActivityProgress = {
	startedAtMs: number;
	endsAtMs: number;
};

/** Normalized activity row returned by the profile discord-activity API. */
export type DiscordActivityDisplay = {
	kind: DiscordActivityKind;
	/** Full patron-facing line — account menu + screen readers. */
	label: string;
	detail?: string;
	imageUrl?: string | null;
	/** Album / artwork collection name shown on cover hover. */
	albumName?: string;
	/** Creator identity accompanying a small portrait asset. */
	creatorName?: string;
	creatorImageUrl?: string | null;
	/** Primary title without the kind prefix — profile hero headline. */
	headline?: string;
	/** App/platform chip — Spotify, Apple Music, game name, etc. */
	source?: string;
	progress?: DiscordActivityProgress;
	/** Poster-derived accent for progress + ambient chrome (nullable when art missing). */
	accentColor?: string | null;
};

const DISCORD_ACTIVITY_PLAYING = 0;
const DISCORD_ACTIVITY_STREAMING = 1;
/** Apple Music, Spotify RPC (non-Lanyard spotify object), etc. */
const DISCORD_ACTIVITY_LISTENING = 2;
const DISCORD_ACTIVITY_WATCHING = 3;

function trimOrNull(value: string | null | undefined): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function readActivityProgress(
	timestamps: LanyardActivityTimestampsPayload | null | undefined,
): DiscordActivityProgress | undefined {
	const startedAtMs = timestamps?.start;
	const endsAtMs = timestamps?.end;
	if (
		typeof startedAtMs !== "number" ||
		typeof endsAtMs !== "number" ||
		!Number.isFinite(startedAtMs) ||
		!Number.isFinite(endsAtMs) ||
		endsAtMs <= startedAtMs
	) {
		return undefined;
	}

	return { startedAtMs, endsAtMs };
}

function formatSpotifyActivity(
	spotify: LanyardSpotifyPayload,
): DiscordActivityDisplay | null {
	const song = trimOrNull(spotify.song);
	if (!song) return null;

	return {
		kind: "listening",
		label: `Listening to ${song}`,
		headline: song,
		source: "Spotify",
		detail: trimOrNull(spotify.artist) ?? undefined,
		albumName: trimOrNull(spotify.album) ?? undefined,
		imageUrl: trimOrNull(spotify.album_art_url),
		progress: readActivityProgress(spotify.timestamps),
	};
}

function findActivityByType(
	activities: LanyardActivityPayload[],
	type: number,
): LanyardActivityPayload | undefined {
	return activities.find((activity) => activity.type === type);
}

/**
 * Discord encodes third-party art as `mp:external/{hash}/https/...` — unwrap to a usable URL.
 */
function resolveDiscordActivityAssetUrl(
	value: string | null | undefined,
): string | null {
	const image = trimOrNull(value);
	if (!image) return null;
	if (image.startsWith("https://")) return image;

	const mpExternalMatch = image.match(/^mp:external\/[^/]+\/(https\/.+)$/);
	if (mpExternalMatch?.[1]) {
		return mpExternalMatch[1].replace(/^https\//, "https://");
	}

	return null;
}

function formatListeningActivity(
	activity: LanyardActivityPayload,
): DiscordActivityDisplay | null {
	const track = trimOrNull(activity.details) ?? trimOrNull(activity.name);
	if (!track) return null;

	const source = trimOrNull(activity.name);

	return {
		kind: "listening",
		label: `Listening to ${track}`,
		headline: track,
		source: source ?? undefined,
		detail: trimOrNull(activity.state) ?? undefined,
		imageUrl: resolveDiscordActivityAssetUrl(activity.assets?.large_image),
		albumName: trimOrNull(activity.assets?.large_text) ?? undefined,
		creatorName:
			trimOrNull(activity.assets?.small_text) ??
			trimOrNull(activity.state) ??
			undefined,
		creatorImageUrl: resolveDiscordActivityAssetUrl(
			activity.assets?.small_image,
		),
		progress: readActivityProgress(activity.timestamps),
	};
}

function formatPlayingActivity(
	activity: LanyardActivityPayload,
): DiscordActivityDisplay | null {
	const name = trimOrNull(activity.name);
	if (!name) return null;

	return {
		kind: "playing",
		label: `Playing ${name}`,
		headline: name,
		source: name,
		detail: trimOrNull(activity.details) ?? undefined,
		progress: readActivityProgress(activity.timestamps),
	};
}

function formatStreamingActivity(
	activity: LanyardActivityPayload,
): DiscordActivityDisplay | null {
	const headline =
		trimOrNull(activity.details) ?? trimOrNull(activity.name) ?? null;
	if (!headline) return null;

	const source = trimOrNull(activity.name);

	return {
		kind: "streaming",
		label: `Streaming ${headline}`,
		headline,
		source: source ?? undefined,
		progress: readActivityProgress(activity.timestamps),
	};
}

function formatWatchingActivity(
	activity: LanyardActivityPayload,
): DiscordActivityDisplay | null {
	const headline =
		trimOrNull(activity.details) ?? trimOrNull(activity.name) ?? null;
	if (!headline) return null;

	const source = trimOrNull(activity.name);

	return {
		kind: "watching",
		label: `Watching ${headline}`,
		headline,
		source: source && source !== headline ? source : undefined,
		detail: trimOrNull(activity.state) ?? undefined,
		imageUrl: resolveDiscordActivityAssetUrl(activity.assets?.large_image),
		progress: readActivityProgress(activity.timestamps),
	};
}

/**
 * Maps a Lanyard presence payload to patron-facing profile activity copy.
 * Returns null when there is nothing worth showing — custom Discord status
 * alone is intentionally omitted (listening / playing / streaming / watching only).
 */
export function formatDiscordActivity(
	payload: LanyardPresencePayload | null | undefined,
): DiscordActivityDisplay | null {
	if (payload == null) return null;

	if (payload.listening_to_spotify && payload.spotify) {
		const listening = formatSpotifyActivity(payload.spotify);
		if (listening) return listening;
	}

	const activities = payload.activities ?? [];

	const listening = findActivityByType(activities, DISCORD_ACTIVITY_LISTENING);
	if (listening) {
		const formatted = formatListeningActivity(listening);
		if (formatted) return formatted;
	}

	const playing = findActivityByType(activities, DISCORD_ACTIVITY_PLAYING);
	if (playing) {
		const formatted = formatPlayingActivity(playing);
		if (formatted) return formatted;
	}

	const streaming = findActivityByType(activities, DISCORD_ACTIVITY_STREAMING);
	if (streaming) {
		const formatted = formatStreamingActivity(streaming);
		if (formatted) return formatted;
	}

	const watching = findActivityByType(activities, DISCORD_ACTIVITY_WATCHING);
	if (watching) {
		const formatted = formatWatchingActivity(watching);
		if (formatted) return formatted;
	}

	return null;
}
