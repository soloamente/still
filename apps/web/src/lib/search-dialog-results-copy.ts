import type { SearchDialogListingKind } from "./search-dialog-listing-kind";

export type SearchDialogResultMode =
	| SearchDialogListingKind
	| "lists"
	| "people";

export type SearchDialogFoundCopy = {
	countLabel: string;
	foundLabel: string;
};

/** Footer count copy — Figma search results: "515 movies found". */
export function searchDialogFoundCopy(
	mode: SearchDialogResultMode,
	count: number,
): SearchDialogFoundCopy {
	const safeCount = Math.max(0, count);
	const countLabel = new Intl.NumberFormat().format(safeCount);
	switch (mode) {
		case "movie":
			return {
				countLabel,
				foundLabel: safeCount === 1 ? "movie found" : "movies found",
			};
		case "tv":
			return {
				countLabel,
				foundLabel: safeCount === 1 ? "show found" : "shows found",
			};
		case "lists":
			return {
				countLabel,
				foundLabel: safeCount === 1 ? "list found" : "lists found",
			};
		case "people":
			return {
				countLabel,
				foundLabel: safeCount === 1 ? "person found" : "people found",
			};
		default: {
			const _exhaustive: never = mode;
			return _exhaustive;
		}
	}
}

/** Empty discovery footer — "9000 results found". */
export function searchDialogEmptyFoundCopy(count: number): SearchDialogFoundCopy {
	const safeCount = Math.max(0, count);
	return {
		countLabel: new Intl.NumberFormat().format(safeCount),
		foundLabel: safeCount === 1 ? "result found" : "results found",
	};
}

/** Footer Tab hint — empty discovery vs cycling the next catalogue. */
export function searchDialogTabHint(
	kind: SearchDialogListingKind,
	options?: { empty?: boolean },
): string {
	if (options?.empty) return "to change category";
	switch (kind) {
		case "movie":
			return "to search shows";
		case "tv":
			return "to search people";
		case "people":
			return "to search movies";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}
