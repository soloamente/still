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
