/**
 * Client-side Sense people-rail rank memory — compare today's traffic order to
 * the last snapshot so tiles can show green↑ / red↓ movement without a server
 * history table.
 */

export const SEARCH_DIALOG_PEOPLE_RANK_STORAGE_KEY =
	"still:search-people-rank:v1";

export type SearchDialogPeopleRankMovement = "up" | "down" | "same" | "new";

type RankedRailId = {
	id: string;
	rankLabel?: string;
};

/** Pure movement — lower place number is better (1st > 2nd). */
export function searchDialogPeopleRankMovement(
	id: string,
	currentRank: number,
	previous: Readonly<Record<string, number>>,
): SearchDialogPeopleRankMovement {
	const prior = previous[id];
	if (prior == null || !Number.isFinite(prior)) return "new";
	if (currentRank < prior) return "up";
	if (currentRank > prior) return "down";
	return "same";
}

/** Build `{ id: 1-basedRank }` from the current rail order. */
export function snapshotFromSearchDialogPeopleRanks(
	items: readonly RankedRailId[],
): Record<string, number> {
	const next: Record<string, number> = {};
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (!item) continue;
		const parsed = Number.parseInt(item.rankLabel ?? "", 10);
		next[item.id] = Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
	}
	return next;
}

export function applySearchDialogPeopleRankMovements<T extends RankedRailId>(
	items: readonly T[],
	previous: Readonly<Record<string, number>>,
): {
	items: Array<T & { rankMovement: SearchDialogPeopleRankMovement }>;
	nextSnapshot: Record<string, number>;
} {
	const enriched = items.map((item, index) => {
		const parsed = Number.parseInt(item.rankLabel ?? "", 10);
		const currentRank =
			Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
		return {
			...item,
			rankMovement: searchDialogPeopleRankMovement(
				item.id,
				currentRank,
				previous,
			),
		};
	});
	return {
		items: enriched,
		nextSnapshot: snapshotFromSearchDialogPeopleRanks(items),
	};
}

/** Read prior ranks from localStorage — empty object when missing or invalid. */
export function readSearchDialogPeopleRankSnapshot(
	storage: Pick<Storage, "getItem"> | null | undefined = globalThis.localStorage,
): Record<string, number> {
	if (!storage) return {};
	try {
		const raw = storage.getItem(SEARCH_DIALOG_PEOPLE_RANK_STORAGE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const out: Record<string, number> = {};
		for (const [id, value] of Object.entries(parsed)) {
			if (typeof value === "number" && Number.isFinite(value) && value > 0) {
				out[id] = Math.floor(value);
			}
		}
		return out;
	} catch {
		return {};
	}
}

/** Persist the current rail order for the next open. */
export function writeSearchDialogPeopleRankSnapshot(
	snapshot: Readonly<Record<string, number>>,
	storage: Pick<Storage, "setItem"> | null | undefined = globalThis.localStorage,
): void {
	if (!storage) return;
	try {
		storage.setItem(
			SEARCH_DIALOG_PEOPLE_RANK_STORAGE_KEY,
			JSON.stringify(snapshot),
		);
	} catch {
		// Quota / private mode — movement simply will not persist.
	}
}
