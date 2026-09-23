/** Empty-search people rail — Figma shows ~10 numbered tiles with photos. */
export const SEARCH_DIALOG_POPULAR_PEOPLE_LIMIT = 12;

type PersonPhotoRow = {
	profileUrl: string | null;
};

/**
 * Keep the API's traffic-ranked order. Photo preference used to reshuffle
 * TMDb popular; Sense search hits now own the rank overlay.
 */
export function pickSearchDialogPopularPeople<T extends PersonPhotoRow>(
	rows: readonly T[],
	limit = SEARCH_DIALOG_POPULAR_PEOPLE_LIMIT,
): T[] {
	return rows.slice(0, limit);
}

export type SearchDialogPopularPeopleRailItem = {
	id: string;
	name: string;
	imageUrl: string | null;
	rankLabel: string;
	isFavorited?: boolean;
};

/** Numbered tiles for `SearchDialogPeopleRail` (rank is overlay copy, not TMDb stats). */
export function searchDialogPopularPeopleToRailItems(
	rows: readonly {
		id: number;
		name: string;
		profileUrl: string | null;
		isFavorited?: boolean;
	}[],
): SearchDialogPopularPeopleRailItem[] {
	return rows.map((row, index) => ({
		id: String(row.id),
		name: row.name,
		imageUrl: row.profileUrl,
		rankLabel: String(index + 1),
		isFavorited: row.isFavorited,
	}));
}
