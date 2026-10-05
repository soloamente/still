/** Long-lived port so a playback tick can finish saving to Sense. */
export const SENSE_COMPANION_WATCH_PORT = "sense-companion-watch";

export type CompanionActivityPayload = {
	details: string | null;
	state: string | null;
	largeImageKey: string | null;
	largeImageText: string | null;
	smallImageKey: string | null;
	smallImageText: string | null;
	startTimestamp: number | null;
	endTimestamp: number | null;
	name: string | null;
	type: number | null;
};

/** Lines chosen in Settings. The helper uses these instead of the built-in card. */
export type DiscordActivityFields = {
	name: string;
	details: string | null;
	state: string | null;
	largeText: string | null;
};

/** Structured watch record. Discord text stays on `activity`. */
export type SenseMedia = {
	provider:
		| "netflix"
		| "disney"
		| "hotstar"
		| "prime"
		| "apple"
		| "max"
		| "web";
	kind: "movie" | "episode";
	title: string;
	season: number | null;
	episode: number | null;
	positionSec: number | null;
	durationSec: number | null;
	/** Episode name when it differs from the show title (profile + Discord parity). */
	episodeTitle?: string;
	/** Site name when `provider` is `web` (Movy, and other players). */
	serviceLabel?: string;
};

/** How the patron is engaging — drives Discord copy and the small status mark. */
export type CompanionPresenceMode = "playing" | "browsing" | "sense";

export type CompanionActivityMessage =
	| {
			type: "sense-companion:activity";
			service: string;
			activity: CompanionActivityPayload;
			senseMedia: SenseMedia | null;
			presenceMode?: CompanionPresenceMode;
			/** Streaming tab path — used for browse copy (movie vs TV page). */
			pagePath?: string | null;
			discordFields?: DiscordActivityFields;
			/** Public Sense profile link for Discord's View profile button. */
			profileButtonUrl?: string | null;
			/** Public Sense page for the film or show that is playing. */
			titleButtonUrl?: string | null;
	  }
	| {
			type: "sense-companion:clear";
			service: string;
	  };

/** Stable key order so the service worker log matches the tests. */
export function formatSenseMediaLog(media: SenseMedia): string {
	return `Sense Companion media: ${JSON.stringify({
		provider: media.provider,
		kind: media.kind,
		title: media.title,
		season: media.season,
		episode: media.episode,
		positionSec: media.positionSec,
		durationSec: media.durationSec,
	})}`;
}

export function isCompanionActivityMessage(
	value: unknown,
): value is CompanionActivityMessage {
	if (typeof value !== "object" || value === null) return false;
	const message = value as { type?: unknown; service?: unknown };
	if (typeof message.service !== "string") return false;
	return (
		message.type === "sense-companion:activity" ||
		message.type === "sense-companion:clear"
	);
}

/** Pause artwork from the vendored PreMiD helper, or the English "Paused" label. */
export function activityIsPaused(activity: CompanionActivityPayload): boolean {
	const image = activity.smallImageKey ?? "";
	const label = activity.smallImageText ?? "";
	return image.endsWith("/pause.png") || label === "Paused";
}

/** One line for the service worker console: title, season/episode, pause, timestamps. */
export function formatActivityLogLine(
	message: CompanionActivityMessage,
): string {
	if (message.type === "sense-companion:clear") {
		return `Sense Companion ${message.service}: cleared`;
	}

	const activity = message.activity;
	const title = activity.name ?? activity.details ?? "Untitled";
	const parts = [
		activity.state,
		activity.largeImageText,
		activity.details,
	].filter(
		(part): part is string =>
			typeof part === "string" && part.length > 0 && part !== title,
	);
	const extra = parts.length > 0 ? ` | ${[...new Set(parts)].join(" | ")}` : "";
	const paused = activityIsPaused(activity);
	const start = activity.startTimestamp ?? "none";
	const end = activity.endTimestamp ?? "none";
	return `Sense Companion ${message.service}: "${title}"${extra} | paused=${paused} | start=${start} end=${end}`;
}
