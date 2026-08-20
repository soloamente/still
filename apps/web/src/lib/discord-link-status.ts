/** Visual states for the Settings Discord connection diagram. */
export const DISCORD_LINK_VISUAL_STATES = [
	"active",
	"connected",
	"setup",
	"idle",
	"pending",
	"locked",
] as const;

export type DiscordLinkVisualState =
	(typeof DISCORD_LINK_VISUAL_STATES)[number];

/** Map link + guild + activity prefs to the diagram pill/footer. */
export function resolveDiscordLinkVisualState(input: {
	connected: boolean;
	guildJoined: boolean;
	activityEnabled: boolean;
}): DiscordLinkVisualState {
	if (!input.connected) return "idle";
	if (!input.guildJoined) return "setup";
	if (input.activityEnabled) return "active";
	return "connected";
}

export function discordLinkStatusCopy(state: DiscordLinkVisualState): {
	pill: string;
	footer: string;
} {
	switch (state) {
		case "active":
			return {
				pill: "Synced",
				footer: "Activity enabled with Discord as source",
			};
		case "connected":
			return {
				pill: "Connected",
				footer: "Connected — hidden on your profile",
			};
		case "setup":
			return {
				pill: "Setup",
				footer: "Couldn't join the presence guild yet",
			};
		case "idle":
			return {
				pill: "Not connected",
				footer: "Connect Discord to show activity on your profile",
			};
		case "pending":
			return {
				pill: "Soon",
				footer: "Listening and Playing ship for every Pro member once funded",
			};
		case "locked":
			return {
				pill: "Pro",
				footer: "Included with Pro",
			};
		default: {
			const _exhaustive: never = state;
			return _exhaustive;
		}
	}
}

/** `@handle` for endpoint pills — empty when the name is missing. */
export function formatAtHandle(value: string | null | undefined): string {
	const trimmed = value?.trim() ?? "";
	if (!trimmed) return "";
	return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
