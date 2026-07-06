import { stillApiOrigin } from "@/lib/still-api-origin";

export type SyncPolarSubscriptionResponse =
	| {
			synced: true;
			tier: "still" | "attuned" | "immersed" | "devoted";
			interval: "month" | "year" | null;
	  }
	| { synced: false; reason: string };

/** Pull the patron's current Polar subscription into the profile row. */
export async function fetchSyncPolarSubscriptionClient(): Promise<SyncPolarSubscriptionResponse> {
	const res = await fetch(`${stillApiOrigin()}/api/plans/sync-subscription`, {
		method: "POST",
		credentials: "include",
	});

	if (res.status === 409) {
		return { synced: false, reason: await res.text() };
	}

	if (!res.ok) {
		throw new Error(`Sync subscription failed (${res.status})`);
	}

	return (await res.json()) as SyncPolarSubscriptionResponse;
}
