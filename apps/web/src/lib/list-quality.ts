/** Minimum description length for public list discoverability (keep in sync with server). */
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

export const LIST_DESCRIPTION_PUBLIC_HINT =
	"Public lists with a short description (about 40+ characters) are easier to find in Community and search.";

export const LIST_ITEM_NOTE_HINT =
	"Add a line on each title — why it belongs here — so readers get your curatorial voice.";
