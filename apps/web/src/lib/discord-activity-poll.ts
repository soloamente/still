import type { ProfileDiscordActivity } from "@/lib/fetch-profile-discord-activity-client";

/** Profile hero + account menu poll interval while the surface is visible. */
export const DISCORD_ACTIVITY_POLL_MS = 30_000;

/** Stable key for crossfade when track / game / stream changes (not progress ticks). */
export function discordActivityTransitionKey(
	activity: ProfileDiscordActivity,
): string {
	return [
		activity.kind,
		activity.headline ?? activity.label,
		activity.detail ?? "",
		activity.imageUrl ?? "",
		activity.source ?? "",
	].join("\0");
}
