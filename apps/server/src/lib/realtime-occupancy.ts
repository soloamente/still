import { env } from "@still/env/server";

import type { PatronActivityState } from "./presence-activity";

export type RoomOccupancyEntry = {
	userId: string;
	activityState: PatronActivityState;
};

/** Fetch active occupancy from the Cloudflare Worker DO. Returns null when Worker is not configured. */
export async function fetchWorkerOccupancy(
	room: string,
): Promise<RoomOccupancyEntry[] | null> {
	if (!env.REALTIME_WORKER_URL || !env.REALTIME_INTERNAL_SECRET) return null;

	try {
		const res = await fetch(
			`${env.REALTIME_WORKER_URL}/occupancy?room=${encodeURIComponent(room)}`,
			{
				headers: {
					Authorization: `Bearer ${env.REALTIME_INTERNAL_SECRET}`,
				},
			},
		);
		if (!res.ok) return null;
		const body = (await res.json()) as { entries?: RoomOccupancyEntry[] };
		return body.entries ?? null;
	} catch {
		return null;
	}
}
