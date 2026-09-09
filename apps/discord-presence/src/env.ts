import type { DiscordGateway } from "./gateway-do";

export interface Env {
	DISCORD_GATEWAY: DurableObjectNamespace<DiscordGateway>;
	DISCORD_BOT_TOKEN: string;
	DISCORD_PRESENCE_GUILD_ID: string;
	DISCORD_PRESENCE_INTERNAL_SECRET: string;
}
