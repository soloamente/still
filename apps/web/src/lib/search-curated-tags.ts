export type CuratedTagSlug = "anime";

export interface CuratedTagDef {
	slug: CuratedTagSlug;
	label: string;
	aliases: string[];
	movie: { genreIds: number[]; keywordIds: number[] };
	tv: { genreIds: number[]; keywordIds: number[] };
}

/** TMDb ids — verify against genre list endpoints when tuning results. */
export const SEARCH_CURATED_TAGS: CuratedTagDef[] = [
	{
		slug: "anime",
		label: "Anime",
		aliases: ["anime", "ani"],
		movie: { genreIds: [16], keywordIds: [210024] },
		tv: { genreIds: [16], keywordIds: [210024] },
	},
];

/** Prefix-match curated shortcuts for the token field. */
export function findCuratedSuggestions(token: string): CuratedTagDef[] {
	const q = token.trim().toLowerCase();
	if (!q) return [];
	return SEARCH_CURATED_TAGS.filter(
		(c) =>
			c.label.toLowerCase().startsWith(q) ||
			c.aliases.some((a) => a.startsWith(q)),
	);
}

export function curatedTagBySlug(slug: string): CuratedTagDef | undefined {
	return SEARCH_CURATED_TAGS.find((c) => c.slug === slug);
}
