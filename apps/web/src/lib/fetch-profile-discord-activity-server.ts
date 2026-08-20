import "server-only";

import { cache } from "react";

import type { ProfileDiscordActivityPayload } from "@/lib/fetch-profile-discord-activity-client";
import { serverApi } from "@/lib/server-api";

/**
 * React-cached GET /api/profiles/:handle/discord-activity for profile hero RSC.
 */
export const fetchProfileDiscordActivityServer = cache(
	async (handle: string): Promise<ProfileDiscordActivityPayload> => {
		try {
			const client = await serverApi();
			const res = await client.api
				.profiles({ handle })
				["discord-activity"].get();
			if (res.error != null) return { visible: false };
			return res.data as ProfileDiscordActivityPayload;
		} catch (err) {
			console.error("[fetchProfileDiscordActivityServer] threw:", err);
			return { visible: false };
		}
	},
);
