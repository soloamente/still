import { patronAppRoomId } from "@still/realtime";

import type { PatronActivityState } from "@/lib/patron-activity-tracker";
import { buildPresenceHeartbeatBody } from "@/lib/patron-activity-tracker";
import type { PatronPresenceSnapshot } from "@/lib/patron-online-presence";
import { isFetchAbortError } from "@/lib/still-api-fetch";
import { stillApiOrigin } from "@/lib/still-api-origin";

export type {
	PatronPresenceRow,
	PatronPresenceSnapshot,
} from "@/lib/patron-online-presence";
export {
	normalizePatronOnlineHandle,
	normalizePatronPresenceSnapshot,
} from "@/lib/patron-online-presence";

function presenceApiUrl(): string {
	return `${stillApiOrigin()}/api/realtime/presence`;
}

/** Batch lookup — which requested handles are online for the signed-in viewer. */
export async function fetchPatronOnlineHandles(
	handles: string[],
	signal?: AbortSignal,
): Promise<PatronPresenceSnapshot | null> {
	if (handles.length === 0) return { presence: [] };

	const url = new URL(`${presenceApiUrl()}/online`);
	url.searchParams.set("handles", handles.join(","));

	try {
		const response = await fetch(url, {
			credentials: "include",
			cache: "no-store",
			signal,
		});
		if (!response.ok) return null;

		return (await response.json()) as PatronPresenceSnapshot;
	} catch (error) {
		// Presence is best-effort — aborts and transient network errors stay silent.
		if (isFetchAbortError(error, signal)) return null;
		if (error instanceof TypeError) return null;
		return null;
	}
}

/** App-wide heartbeat — marks the patron as active anywhere in `(app)`. */
export async function touchPatronAppPresenceClient(
	activityState: PatronActivityState = "active",
): Promise<boolean> {
	try {
		const response = await fetch(presenceApiUrl(), {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(
				buildPresenceHeartbeatBody(patronAppRoomId(), activityState),
			),
		});
		return response.ok;
	} catch {
		return false;
	}
}

/** Leave global online set on unmount / tab close. */
export async function leavePatronAppPresenceClient(opts?: {
	keepalive?: boolean;
}): Promise<boolean> {
	try {
		const response = await fetch(presenceApiUrl(), {
			method: "DELETE",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ room: patronAppRoomId() }),
			keepalive: opts?.keepalive ?? false,
		});
		return response.ok;
	} catch {
		return false;
	}
}
