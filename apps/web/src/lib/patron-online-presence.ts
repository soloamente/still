export type PatronPresenceRow = {
	handle: string;
	state: "active" | "away";
};

export type PatronPresenceSnapshot = {
	presence: PatronPresenceRow[];
};

/** Normalize handle keys for registry + API batching. */
export function normalizePatronOnlineHandle(handle: string): string {
	return handle.trim().toLowerCase();
}

/** Profile handles are 2–24 chars (a-z, 0-9, _, ., -) — reject auth user ids. */
export function isPatronPresenceHandle(handle: string): boolean {
	const normalized = normalizePatronOnlineHandle(handle);
	return /^[a-z0-9._-]{2,24}$/.test(normalized);
}

/** Build a handle → state map from the batch presence payload. */
export function normalizePatronPresenceSnapshot(
	snapshot: PatronPresenceSnapshot,
): Map<string, PatronPresenceRow["state"]> {
	const map = new Map<string, PatronPresenceRow["state"]>();
	for (const row of snapshot.presence) {
		map.set(normalizePatronOnlineHandle(row.handle), row.state);
	}
	return map;
}

/** Skip React updates when a refetched `/online` batch matches the last snapshot. */
export function arePatronPresenceMapsEqual(
	left: ReadonlyMap<string, PatronPresenceRow["state"]>,
	right: ReadonlyMap<string, PatronPresenceRow["state"]>,
): boolean {
	if (left.size !== right.size) return false;
	for (const [handle, state] of left) {
		if (right.get(handle) !== state) return false;
	}
	return true;
}
