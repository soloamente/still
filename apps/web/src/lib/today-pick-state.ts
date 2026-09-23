/**
 * Today on Sense pick completion — the shell owns this instead of the legacy
 * taste-hero auto-swap. Watched / watchlist complete the pick in place; only
 * an explicit **Pick another** (or **Not interested**) moves to the next title.
 */
export type TodayPickState =
	| { phase: "active" }
	| {
			phase: "just_logged";
			tmdbId: number;
			/** Created diary log — `null` when the log flow did not report it (no Undo). */
			logId: string | null;
	  }
	| {
			phase: "complete";
			tmdbId: number;
			/** `elsewhere` = logged/watchlisted from detail or another surface. */
			via: "watchlist" | "elsewhere";
	  };

export type TodayPickEvent =
	| { type: "logged"; tmdbId: number; logId: string | null }
	| { type: "undo" }
	| { type: "watchlisted"; tmdbId: number }
	| { type: "consumed_elsewhere"; tmdbId: number }
	| { type: "pick_another" }
	| { type: "not_interested_advanced" };

export const INITIAL_TODAY_PICK_STATE: TodayPickState = { phase: "active" };

export function reduceTodayPick(
	state: TodayPickState,
	event: TodayPickEvent,
): TodayPickState {
	switch (event.type) {
		case "logged":
			return { phase: "just_logged", tmdbId: event.tmdbId, logId: event.logId };
		case "undo":
			return state.phase === "just_logged" ? INITIAL_TODAY_PICK_STATE : state;
		case "watchlisted":
			// A fresh log outranks the watchlist add — keep Undo reachable.
			return state.phase === "just_logged"
				? state
				: { phase: "complete", tmdbId: event.tmdbId, via: "watchlist" };
		case "consumed_elsewhere":
			// The consumed event also echoes our own actions — never downgrade them.
			return state.phase === "active"
				? { phase: "complete", tmdbId: event.tmdbId, via: "elsewhere" }
				: state;
		case "pick_another":
		case "not_interested_advanced":
			return state.phase === "active" ? state : INITIAL_TODAY_PICK_STATE;
		default: {
			const unhandled: never = event;
			return unhandled;
		}
	}
}

/** Title the patron finished with, or `null` while the pick is still open. */
export function todayPickCompletedTmdbId(state: TodayPickState): number | null {
	return state.phase === "active" ? null : state.tmdbId;
}

/** Confirmation line shown in place of the pick actions once complete. */
export function todayPickStatusCopy(state: TodayPickState): string | null {
	switch (state.phase) {
		case "active":
			return null;
		case "just_logged":
			return "Added to your diary";
		case "complete":
			return state.via === "watchlist"
				? "Added to your watchlist"
				: "Done for today";
		default: {
			const unhandled: never = state;
			return unhandled;
		}
	}
}
