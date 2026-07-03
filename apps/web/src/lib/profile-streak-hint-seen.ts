const PROFILE_STREAK_HINT_SEEN_KEY = "still:profile-streak-hint-seen:v1";

function hasStorage(): boolean {
	return typeof globalThis.localStorage !== "undefined";
}

/** Patron dismissed the default-open streak pill discoverability tooltip. */
export function readProfileStreakHintSeen(): boolean {
	if (!hasStorage()) return false;
	try {
		return (
			globalThis.localStorage.getItem(PROFILE_STREAK_HINT_SEEN_KEY) === "1"
		);
	} catch {
		return false;
	}
}

export function markProfileStreakHintSeen(): void {
	if (!hasStorage()) return;
	try {
		globalThis.localStorage.setItem(PROFILE_STREAK_HINT_SEEN_KEY, "1");
	} catch {
		// Private mode / quota — hint may reappear; non-fatal.
	}
}
