import { Elysia } from "elysia";

import { getDiscordActivityFundingPayload } from "../lib/discord-activity-funding";

/** Public Discord activity funding progress — no auth required. */
export const discordActivityFundingRoute = new Elysia({
	prefix: "/api/discord-activity",
	tags: ["discord-activity"],
}).get("/funding", async () => getDiscordActivityFundingPayload());
