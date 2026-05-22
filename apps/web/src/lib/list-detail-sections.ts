import type { MovieDetailSectionNavItem } from "@/lib/movie-detail-sections";

/** Stable anchor ids for list detail scroll legend (`MovieDetailSectionNav`). */
export const LIST_DETAIL_SECTION = {
	about: "list-section-about",
	films: "list-section-films",
} as const;

export function buildListDetailSectionNavItems({
	hasFilms,
}: {
	hasFilms: boolean;
}): MovieDetailSectionNavItem[] {
	const items: MovieDetailSectionNavItem[] = [
		{ id: LIST_DETAIL_SECTION.about, label: "About" },
	];
	if (hasFilms) {
		items.push({ id: LIST_DETAIL_SECTION.films, label: "Films" });
	}
	return items;
}
