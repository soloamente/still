import { env } from "@still/env/server";

/** Discord OAuth client credentials are configured. */
export function hasDiscordOAuthCredentials(): boolean {
	return Boolean(
		env.DISCORD_CLIENT_ID?.trim() && env.DISCORD_CLIENT_SECRET?.trim(),
	);
}

/** Bot + guild + Lanyard vars required for guild join and activity reads. */
export function hasDiscordActivityInfrastructure(): boolean {
	return Boolean(
		hasDiscordOAuthCredentials() &&
			env.DISCORD_BOT_TOKEN?.trim() &&
			env.DISCORD_PRESENCE_GUILD_ID?.trim() &&
			env.LANYARD_INTERNAL_URL?.trim(),
	);
}
