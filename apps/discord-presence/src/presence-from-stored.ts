import { emptyPresence } from "./empty-presence";
import {
	type DiscordPresenceSnapshot,
	type LanyardPresencePayload,
	toLanyardPresence,
} from "./presence-mapper";

/**
 * Map SQLite `payload_json` to Lanyard on read.
 * Missing or invalid JSON never throws — callers get the empty offline payload.
 */
export function presenceFromStoredJson(
	raw: string | null,
): LanyardPresencePayload {
	if (raw == null || raw.length === 0) {
		return emptyPresence();
	}

	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed === null || typeof parsed !== "object") {
			return emptyPresence();
		}
		return toLanyardPresence(parsed as DiscordPresenceSnapshot);
	} catch {
		return emptyPresence();
	}
}
