const WHATS_NEW_SEEN_STORAGE_PREFIX = "still:whats-new-seen:v1:";

function storageKey(userId: string): string {
	return `${WHATS_NEW_SEEN_STORAGE_PREFIX}${userId}`;
}

function hasStorage(): boolean {
	return typeof globalThis.localStorage !== "undefined";
}

/** Last release id this patron acknowledged (null when unseen or unavailable). */
export function readWhatsNewSeenReleaseId(userId: string): string | null {
	if (!hasStorage()) return null;
	try {
		const raw = globalThis.localStorage.getItem(storageKey(userId));
		if (!raw) return null;
		const trimmed = raw.trim();
		return trimmed.length > 0 ? trimmed : null;
	} catch {
		return null;
	}
}

export function markWhatsNewSeen(userId: string, releaseId: string): void {
	if (!hasStorage()) return;
	try {
		globalThis.localStorage.setItem(storageKey(userId), releaseId);
	} catch {
		// Private mode / quota — dialog may reappear; non-fatal.
	}
}

export function shouldShowWhatsNewRelease(
	userId: string,
	releaseId: string,
): boolean {
	return readWhatsNewSeenReleaseId(userId) !== releaseId;
}
