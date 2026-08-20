import { env } from "@still/env/server";

const DISCORD_API_BASE = "https://discord.com/api/v10";

type DiscordGuildMemberPutBody = {
	access_token: string;
};

function presenceGuildId(): string | null {
	return env.DISCORD_PRESENCE_GUILD_ID?.trim() || null;
}

function botAuthorizationHeader(): string | null {
	const token = env.DISCORD_BOT_TOKEN?.trim();
	if (!token) return null;
	return `Bot ${token}`;
}

function guildMemberUrl(guildId: string, discordUserId: string): string {
	return `${DISCORD_API_BASE}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}`;
}

/**
 * Adds a patron to the Sense Presence guild after Discord OAuth.
 * Requires the patron's OAuth access token from the link flow.
 */
export async function addPatronToPresenceGuild(
	discordUserId: string,
	userOAuthAccessToken: string,
): Promise<boolean> {
	const guildId = presenceGuildId();
	const authorization = botAuthorizationHeader();
	const memberId = discordUserId.trim();
	const accessToken = userOAuthAccessToken.trim();

	if (!guildId || !authorization || !memberId || !accessToken) {
		return false;
	}

	try {
		const response = await fetch(guildMemberUrl(guildId, memberId), {
			method: "PUT",
			headers: {
				Authorization: authorization,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				access_token: accessToken,
			} satisfies DiscordGuildMemberPutBody),
			signal: AbortSignal.timeout(10_000),
		});

		// Discord returns 201 Created or 204 No Content when the member is added.
		return response.status === 201 || response.status === 204;
	} catch (error) {
		console.error("[discord-presence-guild] add patron failed", {
			discordUserId: memberId,
			error,
		});
		return false;
	}
}

/**
 * Removes a patron from the Sense Presence guild on disconnect or delete.
 * Best effort — failures are logged and do not throw.
 */
export async function removePatronFromPresenceGuild(
	discordUserId: string,
): Promise<boolean> {
	const guildId = presenceGuildId();
	const authorization = botAuthorizationHeader();
	const memberId = discordUserId.trim();

	if (!guildId || !authorization || !memberId) {
		return false;
	}

	try {
		const response = await fetch(guildMemberUrl(guildId, memberId), {
			method: "DELETE",
			headers: {
				Authorization: authorization,
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(10_000),
		});

		// 204 = removed; 404 = already gone — both are acceptable outcomes.
		return response.status === 204 || response.status === 404;
	} catch (error) {
		console.error("[discord-presence-guild] remove patron failed", {
			discordUserId: memberId,
			error,
		});
		return false;
	}
}

/** @internal Test helper — builds the guild member REST URL without network I/O. */
export function discordPresenceGuildMemberUrlForTests(
	discordUserId: string,
): string | null {
	const guildId = presenceGuildId();
	if (!guildId) return null;
	return guildMemberUrl(guildId, discordUserId);
}
