/**
 * Pure radial menu specs for catalogue lobby posters — icons and handlers live in
 * `CataloguePosterTile`; tests assert ids/labels/order without React.
 */

export type CatalogueRadialSurface = "home" | "diary" | "watchlist";

export type CatalogueRadialItemSpec = {
	id: string;
	label: string;
	shortcut?: string;
	variant?: "default" | "destructive";
};

export type BuildCatalogueRadialSpecsInput = {
	surface: CatalogueRadialSurface;
	listingKind: "movie" | "tv";
	signedIn: boolean;
	/** Diary — PATCH quick log when a row (or TV group latest log) is available. */
	canEditLog?: boolean;
	/** Home — toggles Add vs Remove watchlist label. */
	inWatchlist?: boolean;
	/** Home / watchlist — patron already has diary row(s) for this title. */
	hasPriorLog?: boolean;
};

/** Stable slot order: Open → Copy → Log → Edit → Watchlist → Add to list → Remove. */
const SLOT_ORDER: string[] = [
	"open",
	"copy",
	"quick-log",
	"edit-log",
	"watchlist",
	"add-to-list",
	"remove-watchlist",
];

function sortSpecs(
	specs: CatalogueRadialItemSpec[],
): CatalogueRadialItemSpec[] {
	const rank = new Map(SLOT_ORDER.map((id, i) => [id, i]));
	return [...specs].sort(
		(a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
	);
}

/**
 * Returns which radial actions appear for this lobby tile — handlers wired in the tile component.
 */
export function buildCatalogueRadialItemSpecs(
	input: BuildCatalogueRadialSpecsInput,
): CatalogueRadialItemSpec[] {
	const {
		surface,
		listingKind,
		signedIn,
		canEditLog,
		inWatchlist,
		hasPriorLog,
	} = input;
	const isMovie = listingKind === "movie";

	const specs: CatalogueRadialItemSpec[] = [
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

	if (surface === "home" || surface === "watchlist") {
		specs.push({
			id: "quick-log",
			label: hasPriorLog ? "Rewatch" : "Quick log",
			shortcut: hasPriorLog ? "R" : "L",
		});
	}

	if (surface === "diary" && canEditLog) {
		specs.push({
			id: "edit-log",
			label: "Edit log",
			shortcut: "E",
		});
	}

	if (surface === "home") {
		specs.push({
			id: "watchlist",
			label: inWatchlist ? "Remove from watchlist" : "Add to watchlist",
			shortcut: "W",
			variant: inWatchlist ? "destructive" : "default",
		});
	}

	if (surface !== "watchlist") {
		specs.push({
			id: "add-to-list",
			label: "Add to list",
			shortcut: "A",
		});
	}

	// Watchlist lobby: add-to-list before destructive remove (sort order).
	if (surface === "watchlist") {
		specs.push({
			id: "add-to-list",
			label: "Add to list",
			shortcut: "A",
		});
	}

	if (surface === "watchlist") {
		specs.push({
			id: "remove-watchlist",
			label: "Remove from watchlist",
			shortcut: "W",
			variant: "destructive",
		});
	}

	return sortSpecs(specs);
}

/** Signed-out patrons only get navigation + copy. */
export function isCatalogueRadialGatedAction(actionId: string): boolean {
	return actionId !== "open" && actionId !== "copy";
}
