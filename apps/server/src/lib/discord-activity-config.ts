import { env } from "@still/env/server";

/** Whether the Discord activity feature flag is explicitly on. */
export function isDiscordActivityFeatureFlagEnabled(): boolean {
	const raw = env.DISCORD_ACTIVITY_ENABLED?.trim().toLowerCase();
	return raw === "true" || raw === "1" || raw === "yes";
}

/** All secrets/URLs required before Connect Discord or Lanyard reads run. */
export function hasDiscordActivityInfrastructure(): boolean {
	return Boolean(
		env.DISCORD_CLIENT_ID &&
			env.DISCORD_CLIENT_SECRET &&
			env.DISCORD_BOT_TOKEN &&
			env.DISCORD_PRESENCE_GUILD_ID &&
			env.LANYARD_INTERNAL_URL,
	);
}

/**
 * Discord profile activity ships only when the flag is on and every dependency
 * is configured — dev boot stays safe when vars are absent.
 */
export function isDiscordActivityEnabled(): boolean {
	return (
		isDiscordActivityFeatureFlagEnabled() && hasDiscordActivityInfrastructure()
	);
}
