/** Catalogue / people mode shown in the search-dialog Tab chip. */
export type SearchDialogListingKind = "movie" | "tv" | "people";

/** Movies ↔ Shows only — for genre / studio catalogue filters. */
export type SearchDialogCatalogueKind = Exclude<
	SearchDialogListingKind,
	"people"
>;

/** Tab (and the header chip) cycle Movies → Shows → People → Movies. */
export function cycleSearchListingKind(
	kind: SearchDialogListingKind,
): SearchDialogListingKind {
	switch (kind) {
		case "movie":
			return "tv";
		case "tv":
			return "people";
		case "people":
			return "movie";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Next Tab target label for the media chip / aria. */
export function searchDialogListingKindLabel(
	kind: SearchDialogListingKind,
): string {
	switch (kind) {
		case "movie":
			return "Movies";
		case "tv":
			return "Shows";
		case "people":
			return "People";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Narrow people mode out for catalogue APIs. */
export function searchDialogCatalogueKind(
	kind: SearchDialogListingKind,
): SearchDialogCatalogueKind {
	return kind === "tv" ? "tv" : "movie";
}
