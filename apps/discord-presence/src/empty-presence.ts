import type { LanyardPresencePayload } from "./presence-mapper";

/** Lanyard-shaped empty payload used when nothing is stored or mapping fails. */
export function emptyPresence(
	discordStatus = "offline",
): LanyardPresencePayload {
	return {
		discord_status: discordStatus,
		activities: [],
		listening_to_spotify: false,
		spotify: null,
	};
}
