/** Minimum description length for Community / discovery surfacing (Tier 1 list quality). */
export const LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS = 40;

export const LIST_ITEM_NOTE_MAX_CHARS = 500;

export function listHasDiscoverabilityDescription(
	description: string | null | undefined,
): boolean {
	return (
		(description?.trim().length ?? 0) >=
		LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS
	);
}

export function countListItemAnnotations(
	items: ReadonlyArray<{ note: string | null | undefined }>,
): number {
	let count = 0;
	for (const row of items) {
		if ((row.note?.trim().length ?? 0) > 0) count += 1;
	}
	return count;
}
