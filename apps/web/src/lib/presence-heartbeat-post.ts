import type { PatronActivityState } from "@/lib/patron-activity-tracker";
import { stillApiOrigin } from "@/lib/still-api-origin";

export type PresenceHeartbeatBody = {
	room: string;
	activityState: PatronActivityState;
};

function presenceApiUrl(): string {
	return `${stillApiOrigin()}/api/realtime/presence`;
}

/**
 * POST presence heartbeat — prefers sendBeacon for hidden-tab away flips because
 * background fetch keepalive is dropped or throttled in some browsers.
 */
export async function postPresenceHeartbeat(
	body: PresenceHeartbeatBody,
	opts?: { keepalive?: boolean },
): Promise<boolean> {
	const url = presenceApiUrl();
	const payload = JSON.stringify(body);

	if (
		opts?.keepalive &&
		body.activityState === "away" &&
		typeof navigator !== "undefined" &&
		typeof navigator.sendBeacon === "function"
	) {
		return navigator.sendBeacon(
			url,
			new Blob([payload], { type: "application/json" }),
		);
	}

	try {
		const response = await fetch(url, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: payload,
			keepalive: opts?.keepalive ?? false,
		});
		return response.ok;
	} catch {
		return false;
	}
}
