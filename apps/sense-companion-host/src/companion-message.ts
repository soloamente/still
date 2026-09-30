/** Mirrors the extension's activity message. The host cannot import the WXT app. */
export type CompanionActivityPayload = {
	details: string | null;
	state: string | null;
	largeImageKey?: string | null;
	largeImageText: string | null;
	smallImageKey: string | null;
	smallImageText: string | null;
	startTimestamp: number | null;
	endTimestamp: number | null;
	name: string | null;
	type: number | null;
};

export type SenseMedia = {
	provider: "netflix" | "disney" | "hotstar" | "prime" | "apple" | "max";
	kind: "movie" | "episode";
	title: string;
	season: number | null;
	episode: number | null;
	positionSec: number | null;
	durationSec: number | null;
};

/** Lines chosen in Settings. Absent means the built-in card. */
export type DiscordActivityFields = {
	name: string;
	details: string | null;
	state: string | null;
	largeText: string | null;
};

export type CompanionActivityMessage =
	| {
			type: "sense-companion:activity";
			service: string;
			activity: CompanionActivityPayload;
			senseMedia: SenseMedia | null;
			discordFields?: DiscordActivityFields;
			/** Public Sense profile link for Discord's View profile button. */
			profileButtonUrl?: string | null;
	  }
	| {
			type: "sense-companion:clear";
			service: string;
	  };

export function isCompanionActivityMessage(
	value: unknown,
): value is CompanionActivityMessage {
	if (typeof value !== "object" || value === null) return false;
	const message = value as { type?: unknown; service?: unknown };
	if (typeof message.service !== "string") return false;
	return (
		message.type === "sense-companion:activity" ||
		message.type === "sense-companion:clear"
	);
}

/** The paired browser sends this even when it is not the one playing. */
export function isCompanionRelay(value: unknown): boolean {
	if (typeof value !== "object" || value === null) return false;
	return (value as { type?: unknown }).type === "sense-companion:relay";
}

/** The setup page asks whether the Discord desktop pipe is open. */
export function isDiscordStatusRequest(value: unknown): boolean {
	if (typeof value !== "object" || value === null) return false;
	return (
		(value as { type?: unknown }).type === "sense-companion:discord-status"
	);
}
