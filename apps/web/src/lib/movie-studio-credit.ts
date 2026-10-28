import { tmdbLogoUrlFromPath } from "@/lib/tmdb-logo-url";

/** TMDb `production_companies` row, only the fields the hero credit reads. */
export type MovieProductionCompanyRef = {
	id?: number | null;
	name?: string | null;
	logo_path?: string | null;
};

export type MovieStudioMark = {
	id: number;
	name: string;
	logoUrl: string;
};

/**
 * Two wordmarks read as a credit under the title.
 * A third turns the hero into a sponsor strip.
 */
export const MOVIE_STUDIO_MARK_LIMIT = 2;

/** First companies that actually have a mark, in TMDb order. */
export function movieStudioMarks(
	companies: readonly MovieProductionCompanyRef[] | null | undefined,
): MovieStudioMark[] {
	if (!companies?.length) return [];
	const marks: MovieStudioMark[] = [];
	for (const company of companies) {
		if (marks.length >= MOVIE_STUDIO_MARK_LIMIT) break;
		const name = company.name?.trim() ?? "";
		const id = company.id;
		if (!name || id == null || !Number.isFinite(id)) continue;
		const logoUrl = tmdbLogoUrlFromPath(company.logo_path, "w185");
		if (!logoUrl) continue;
		marks.push({ id, name, logoUrl });
	}
	return marks;
}

/** When nobody has a mark, the first company name is still the credit. */
export function movieStudioNameFallback(
	companies: readonly MovieProductionCompanyRef[] | null | undefined,
): { id: number; name: string } | null {
	if (movieStudioMarks(companies).length > 0) return null;
	for (const company of companies ?? []) {
		const name = company.name?.trim() ?? "";
		const id = company.id;
		if (!name || id == null || !Number.isFinite(id)) continue;
		return { id, name };
	}
	return null;
}

/** Button name: films on a movie page, shows on a TV page. */
export function studioSearchButtonLabel(
	studioName: string,
	listingKind: "movie" | "tv",
): string {
	const name = studioName.trim();
	switch (listingKind) {
		case "movie":
			return `Search films from ${name}`;
		case "tv":
			return `Search shows from ${name}`;
		default: {
			const _exhaustive: never = listingKind;
			return _exhaustive;
		}
	}
}
