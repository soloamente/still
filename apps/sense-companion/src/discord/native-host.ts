import type { CompanionActivityMessage } from "../presence/activity-log";
import {
	publishDiscordDesktopActivity,
	requestDiscordDesktopStatus,
} from "./desktop-client";

export type DiscordDesktopStatus =
	| "checking"
	| "connected"
	| "closed"
	| "missing";

/** Connected is green. Closed Discord and a missing app id are both red. */
export function discordStatusTone(
	status: DiscordDesktopStatus,
): "checking" | "connected" | "disconnected" {
	switch (status) {
		case "checking":
			return "checking";
		case "connected":
			return "connected";
		case "closed":
		case "missing":
			return "disconnected";
		default: {
			const neverStatus: never = status;
			return neverStatus;
		}
	}
}

export function discordStatusCopy(status: DiscordDesktopStatus): string {
	switch (status) {
		case "checking":
			return "Checking Discord…";
		case "connected":
			return "Discord is connected.";
		case "closed":
			return "Open the Discord desktop app, then check again.";
		case "missing":
			return "Discord is not configured in this extension build.";
		default: {
			const neverStatus: never = status;
			return neverStatus;
		}
	}
}

/**
 * Whether Discord desktop accepted a local socket. Store builds use the
 * extension only — no separate helper install.
 */
export async function requestDiscordStatus(): Promise<DiscordDesktopStatus> {
	const status = await requestDiscordDesktopStatus();
	return status;
}

/** Push playback to Discord desktop over the local websocket IPC. */
export function postDiscordHostMessage(
	message: CompanionActivityMessage & {
		profileToken?: string;
		sourceId?: string;
		profileButtonUrl?: string | null;
		titleButtonUrl?: string | null;
		discordFields?: {
			name?: string | null;
			details?: string | null;
			state?: string | null;
			largeText?: string | null;
		};
	},
): boolean {
	void publishDiscordDesktopActivity(message).catch((error: unknown) => {
		console.info("Sense Companion Discord publish failed", error);
	});
	return true;
}
