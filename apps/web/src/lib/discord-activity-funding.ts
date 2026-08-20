import { stillApiOrigin } from "@/lib/still-api-origin";

export type DiscordActivityFundingPayload = {
	current: number;
	target: number;
	productionEnabled: boolean;
};

/** Public Discord activity funding progress — no auth required. */
export async function fetchDiscordActivityFunding(): Promise<DiscordActivityFundingPayload | null> {
	const res = await fetch(`${stillApiOrigin()}/api/discord-activity/funding`, {
		credentials: "omit",
	});
	if (!res.ok) return null;
	return (await res.json()) as DiscordActivityFundingPayload;
}
