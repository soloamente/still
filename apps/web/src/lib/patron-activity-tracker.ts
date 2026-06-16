/** Client-side patron activity state sent on presence heartbeats. */
export type PatronActivityState = "active" | "away";

/** No input for this long on a visible tab → away. */
export const PATRON_AFK_IDLE_MS = 5 * 60 * 1000;

/** Throttle noisy input events before recomputing activity state. */
export const PATRON_ACTIVITY_INPUT_THROTTLE_MS = 30_000;

/** Recompute interval while the tab stays visible (catches idle timeout). */
export const PATRON_ACTIVITY_RECOMPUTE_MS = 30_000;

const INPUT_EVENTS = [
	"mousemove",
	"pointerdown",
	"keydown",
	"scroll",
	"touchstart",
] as const;

export type PatronActivityTrackerInput = {
	nowMs: number;
	lastInputAtMs: number;
	documentHidden: boolean;
};

/** Pure AFK derivation — tab hidden wins; else idle window. */
export function derivePatronActivityState(
	input: PatronActivityTrackerInput,
): PatronActivityState {
	if (input.documentHidden) return "away";
	if (input.nowMs - input.lastInputAtMs >= PATRON_AFK_IDLE_MS) return "away";
	return "active";
}

/** JSON body for POST /api/realtime/presence heartbeats. */
export function buildPresenceHeartbeatBody(
	room: string,
	activityState: PatronActivityState = "active",
) {
	return { room, activityState };
}

/** Pure guard — skip the initial mount and no-op recomputes. */
export function shouldEmitPatronActivityFlip(
	previous: PatronActivityState | null,
	next: PatronActivityState,
): boolean {
	return previous !== null && previous !== next;
}

export { INPUT_EVENTS as PATRON_ACTIVITY_INPUT_EVENTS };
