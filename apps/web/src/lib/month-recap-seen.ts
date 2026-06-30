const MONTH_RECAP_SEEN_STORAGE_PREFIX = "still:month-recap-seen:v1:";

function storageKey(userId: string, monthKey: string): string {
	return `${MONTH_RECAP_SEEN_STORAGE_PREFIX}${userId}:${monthKey}`;
}

function hasStorage(): boolean {
	return typeof globalThis.localStorage !== "undefined";
}

/** Whether this patron already dismissed the recap for the celebrated month. */
export function readMonthRecapSeen(userId: string, monthKey: string): boolean {
	if (!hasStorage()) return false;
	try {
		return (
			globalThis.localStorage.getItem(storageKey(userId, monthKey)) === "1"
		);
	} catch {
		return false;
	}
}

export function markMonthRecapSeen(userId: string, monthKey: string): void {
	if (!hasStorage()) return;
	try {
		globalThis.localStorage.setItem(storageKey(userId, monthKey), "1");
	} catch {
		// Private mode / quota — dialog may reappear; non-fatal.
	}
}

export function shouldShowMonthRecap(
	userId: string,
	monthKey: string,
): boolean {
	return !readMonthRecapSeen(userId, monthKey);
}
