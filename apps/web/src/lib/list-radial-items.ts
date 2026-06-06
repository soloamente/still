/**
 * Pure radial menu specs for list-detail title tiles — icons and handlers live in
 * `ListDetailPosterTile`; tests assert ids/labels/order without React.
 */

export type ListRadialItemSpec = {
	id: string;
	label: string;
	shortcut?: string;
	variant?: "default" | "destructive";
};

export type BuildListRadialSpecsInput = {
	signedIn: boolean;
	listingKind: "movie" | "tv";
	hasPriorLog: boolean;
	liked: boolean;
	/** Owner or collaborator — custom list membership edits only. */
	canEditMembership: boolean;
	isFavoritesList: boolean;
};

/** Stable slot order for list-detail poster radial menus. */
const SLOT_ORDER: string[] = [
	"open",
	"copy",
	"quick-log",
	"edit-log",
	"add-to-list",
	"toggle-favorite",
	"remove-from-list",
];

function sortSpecs(specs: ListRadialItemSpec[]): ListRadialItemSpec[] {
	const rank = new Map(SLOT_ORDER.map((id, i) => [id, i]));
	return [...specs].sort(
		(a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
	);
}

/**
 * Returns which radial actions appear on a list-detail title tile.
 */
export function buildListRadialItemSpecs(
	input: BuildListRadialSpecsInput,
): ListRadialItemSpec[] {
	const {
		signedIn,
		listingKind,
		hasPriorLog,
		liked,
		canEditMembership,
		isFavoritesList,
	} = input;
	const isMovie = listingKind === "movie";

	const specs: ListRadialItemSpec[] = [
		{
			id: "open",
			label: isMovie ? "Open film" : "Open series",
			shortcut: "O",
		},
		{
			id: "copy",
			label: "Copy link",
			shortcut: "C",
		},
	];

	if (!signedIn) {
		return sortSpecs(specs);
	}

	specs.push({
		id: "quick-log",
		label: hasPriorLog ? "Rewatch" : "Quick log",
		shortcut: hasPriorLog ? "R" : "L",
	});

	if (hasPriorLog) {
		specs.push({
			id: "edit-log",
			label: "Edit log",
			shortcut: "E",
		});
		specs.push({
			id: "add-to-list",
			label: "Add to list",
			shortcut: "A",
		});
		specs.push({
			id: "toggle-favorite",
			label: liked ? "Remove from favorites" : "Add to favorites",
			shortcut: "F",
			variant: liked ? "destructive" : "default",
		});
	}

	if (canEditMembership && !isFavoritesList) {
		specs.push({
			id: "remove-from-list",
			label: "Remove from list",
			shortcut: "X",
			variant: "destructive",
		});
	}

	return sortSpecs(specs);
}

/** Signed-out patrons only get navigation + copy. */
export function isListRadialGatedAction(actionId: string): boolean {
	return actionId !== "open" && actionId !== "copy";
}
