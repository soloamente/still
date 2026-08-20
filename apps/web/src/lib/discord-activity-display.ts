import type { ProfileDiscordActivity } from "@/lib/fetch-profile-discord-activity-client";

/** Subtle image depth on raised tiles — pure black/white outline per design system. */
export const DISCORD_ACTIVITY_ART_OUTLINE_CLASSNAME =
	"outline outline-1 outline-black/10 dark:outline-white/10";

const KIND_VERB: Record<ProfileDiscordActivity["kind"], string> = {
	listening: "Listening",
	playing: "Playing",
	streaming: "Streaming",
	watching: "Watching",
};

/** Eyebrow chip above the headline — e.g. "Listening · Apple Music". */
export function discordActivityEyebrow(
	activity: ProfileDiscordActivity,
): string {
	const verb = KIND_VERB[activity.kind];
	const source = activity.source?.trim();
	if (source) {
		return `${verb} · ${source}`;
	}
	return verb;
}

/** Primary title — prefers API headline, falls back to parsing label prefixes. */
export function discordActivityHeadline(
	activity: ProfileDiscordActivity,
): string {
	const headline = activity.headline?.trim();
	if (headline) return headline;

	const label = activity.label.trim();
	const prefixes = ["Listening to ", "Playing ", "Streaming ", "Watching "];
	for (const prefix of prefixes) {
		if (label.startsWith(prefix)) {
			return label.slice(prefix.length).trim() || label;
		}
	}

	return label;
}

export function computeDiscordActivityProgress(
	progress: ProfileDiscordActivity["progress"],
	nowMs: number,
): { ratio: number; elapsedMs: number; durationMs: number } | null {
	if (!progress) return null;

	const { startedAtMs, endsAtMs } = progress;
	const durationMs = endsAtMs - startedAtMs;
	if (durationMs <= 0) return null;

	const elapsedMs = Math.min(durationMs, Math.max(0, nowMs - startedAtMs));
	const ratio = Math.min(1, Math.max(0, elapsedMs / durationMs));

	return { ratio, elapsedMs, durationMs };
}

/** mm:ss elapsed label for the progress row. */
export function formatDiscordActivityElapsedLabel(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
