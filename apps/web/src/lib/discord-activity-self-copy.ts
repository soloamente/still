import type { ProfileDiscordActivity } from "@/lib/fetch-profile-discord-activity-client";

/**
 * Second-person screen reader label for the signed-in patron's Discord activity
 * (account menu self preview — profile hero stays third person).
 */
export function discordActivitySelfScreenReaderLabel(
	activity: ProfileDiscordActivity,
): string {
	const detail = activity.detail?.trim();

	switch (activity.kind) {
		case "listening": {
			// API label: "Listening to {song}"
			const song = activity.label.replace(/^Listening to\s+/i, "").trim();
			if (!song) return "You are listening to music on Discord";
			return detail
				? `You are listening to ${song} by ${detail}`
				: `You are listening to ${song}`;
		}
		case "playing": {
			const game = activity.label.replace(/^Playing\s+/i, "").trim();
			if (!game) return "You are playing a game on Discord";
			return detail
				? `You are playing ${game}: ${detail}`
				: `You are playing ${game}`;
		}
		case "streaming": {
			const title = activity.label.replace(/^Streaming\s+/i, "").trim();
			if (!title) return "You are streaming on Discord";
			return `You are streaming ${title}`;
		}
		case "watching": {
			const title = activity.label.replace(/^Watching\s+/i, "").trim();
			if (!title) return "You are watching something on Discord";
			return detail
				? `You are watching ${title}: ${detail}`
				: `You are watching ${title}`;
		}
		default: {
			const _exhaustive: never = activity.kind;
			return _exhaustive;
		}
	}
}
