import { stillApiOrigin } from "@/lib/still-api-origin";

export type SyncPolarCheckoutResponse =
	| {
			synced: true;
			tier: "attuned" | "immersed" | "devoted";
			interval: "month" | "year";
	  }
	| { synced: false; reason: string };

/** After Polar checkout, pull subscription tier when webhooks cannot reach localhost. */
export async function fetchSyncPolarCheckoutClient(
	checkoutId: string,
): Promise<SyncPolarCheckoutResponse> {
	const res = await fetch(`${stillApiOrigin()}/api/plans/sync-checkout`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ checkoutId }),
	});

	if (res.status === 409) {
		return { synced: false, reason: await res.text() };
	}

	if (!res.ok) {
		throw new Error(`Sync checkout failed (${res.status})`);
	}

	return (await res.json()) as SyncPolarCheckoutResponse;
}
