/** The five result categories the search dialog can show, in auto-switch priority order. */
export type SearchCategory = "films" | "tv" | "castcrew" | "lists" | "members";

/** Fixed auto-switch priority: films → tv → castcrew → lists → members. */
export const CATEGORY_PRIORITY: SearchCategory[] = [
	"films",
	"tv",
	"castcrew",
	"lists",
	"members",
];

/** Lists & Members require sign-in; everything else is always available. */
export function enabledCategories(signedIn: boolean): SearchCategory[] {
	return CATEGORY_PRIORITY.filter(
		(c) => signedIn || (c !== "lists" && c !== "members"),
	);
}

export type ResolveActiveCategoryArgs = {
	current: SearchCategory;
	manualCategory: SearchCategory | null;
	counts: Record<SearchCategory, number>;
	priority: SearchCategory[];
	anyLoading: boolean;
};

/**
 * Decide which category to show. While loading, hold steady (avoid flicker).
 * A manual pick (within enabled categories) always wins. Otherwise keep the
 * current category if it has results, else jump to the first priority category
 * that does; if none have results, stay put.
 */
export function resolveActiveCategory({
	current,
	manualCategory,
	counts,
	priority,
	anyLoading,
}: ResolveActiveCategoryArgs): SearchCategory {
	if (anyLoading) return current;
	if (manualCategory && priority.includes(manualCategory)) {
		return manualCategory;
	}
	if ((counts[current] ?? 0) > 0) return current;
	const firstWithResults = priority.find((c) => (counts[c] ?? 0) > 0);
	return firstWithResults ?? current;
}
