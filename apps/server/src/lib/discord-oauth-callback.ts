/**
 * Server barrel — Discord OAuth side effects live in @still/auth for Better Auth hooks.
 */
export {
	type DiscordLinkStatus,
	disconnectDiscordAccountForUser,
	fetchDiscordAccountForUser,
	finishDiscordPresenceGuildSetup,
	handleDiscordAccountLinked,
	handleDiscordAccountUnlinked,
	readDiscordLinkStatusForUser,
} from "@still/auth/lib/discord-oauth-callback";

export {
	addPatronToPresenceGuild,
	discordPresenceGuildMemberUrlForTests,
	removePatronFromPresenceGuild,
} from "@still/auth/lib/discord-presence-guild";
