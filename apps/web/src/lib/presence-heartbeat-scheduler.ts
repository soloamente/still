import type { PatronActivityState } from "@/lib/patron-activity-tracker";

/** Debounce away posts so rapid tab switches settle before sendBeacon fires. */
export const PRESENCE_AWAY_HEARTBEAT_DEBOUNCE_MS = 400;

export type PresenceHeartbeatPoster = (
	state: PatronActivityState,
	opts?: { keepalive?: boolean },
) => Promise<boolean>;

/**
 * Coalesce active/away presence posts — active is immediate; away waits briefly
 * so a quick tab round-trip does not leave Redis stuck on away.
 */
export function createPresenceHeartbeatScheduler(
	readState: () => PatronActivityState,
	post: PresenceHeartbeatPoster,
	awayDebounceMs: number = PRESENCE_AWAY_HEARTBEAT_DEBOUNCE_MS,
) {
	let awayTimer: ReturnType<typeof setTimeout> | null = null;
	let lastPosted: PatronActivityState | null = null;

	const clearAwayTimer = () => {
		if (!awayTimer) return;
		clearTimeout(awayTimer);
		awayTimer = null;
	};

	const postNow = async (state: PatronActivityState): Promise<boolean> => {
		lastPosted = state;
		const hidden =
			typeof document !== "undefined" && document.hidden && state === "away";
		return post(state, hidden ? { keepalive: true } : undefined);
	};

	return {
		/** Call when aggregate activity flips (from tab sync or local tracker). */
		onActivityChange(state: PatronActivityState) {
			if (state === "active") {
				clearAwayTimer();
				if (lastPosted === "active") return;
				void postNow("active");
				return;
			}

			clearAwayTimer();
			awayTimer = setTimeout(() => {
				awayTimer = null;
				if (readState() !== "away") return;
				if (lastPosted === "away") return;
				void postNow("away");
			}, awayDebounceMs);
		},

		/** Periodic heartbeat — only reinforces settled state (no away while debouncing). */
		async tick(): Promise<boolean> {
			const state = readState();
			if (state === "active") {
				clearAwayTimer();
				return postNow("active");
			}
			if (awayTimer) return false;
			if (lastPosted === "away") return false;
			return postNow("away");
		},

		dispose() {
			clearAwayTimer();
		},
	};
}
