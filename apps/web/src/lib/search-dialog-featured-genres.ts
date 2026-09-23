import type { SearchDialogGenre } from "@/lib/search-query-tags";

/** One chip in the empty-state genre rail (TMDb genre or curated Anime). */
export type SearchDialogGenreRailItem =
	| {
			kind: "genre";
			id: number;
			name: string;
			listingKind: "movie" | "tv";
	  }
	| { kind: "curated"; slug: "anime"; label: "Anime" };

/**
 * Figma rail order — match by lowercase name, then append leftover genres.
 * Anime is a curated Sense tag (not a TMDb genre) and sits after Animation.
 */
const FEATURED_SLOTS: ReadonlyArray<
	| { kind: "genre"; names: readonly string[] }
	| { kind: "curated"; slug: "anime" }
> = [
	{ kind: "genre", names: ["fantasy"] },
	{ kind: "genre", names: ["action"] },
	{ kind: "genre", names: ["horror"] },
	{ kind: "genre", names: ["romance"] },
	{ kind: "genre", names: ["adventure"] },
	{ kind: "genre", names: ["animation"] },
	{ kind: "curated", slug: "anime" },
	{ kind: "genre", names: ["thriller"] },
	{
		kind: "genre",
		names: ["science fiction", "sci-fi", "sci-fi & fantasy"],
	},
	{ kind: "genre", names: ["documentary"] },
];

function normalizeGenreName(name: string): string {
	return name.trim().toLowerCase();
}

function findGenreByNames(
	genres: SearchDialogGenre[],
	names: readonly string[],
	usedIds: Set<number>,
): SearchDialogGenre | null {
	const wanted = new Set(names.map(normalizeGenreName));
	return (
		genres.find((genre) => {
			if (usedIds.has(genre.id)) return false;
			return wanted.has(normalizeGenreName(genre.name));
		}) ?? null
	);
}

/**
 * Ordered genre-rail chips: Figma featured names first, then remaining
 * TMDb genres alphabetically so the rail still covers the full list.
 */
export function buildSearchDialogGenreRailItems(
	genres: SearchDialogGenre[],
	listingKind: "movie" | "tv",
): SearchDialogGenreRailItem[] {
	const usedIds = new Set<number>();
	const items: SearchDialogGenreRailItem[] = [];

	for (const slot of FEATURED_SLOTS) {
		if (slot.kind === "curated") {
			items.push({ kind: "curated", slug: "anime", label: "Anime" });
			continue;
		}
		const match = findGenreByNames(genres, slot.names, usedIds);
		if (!match) continue;
		usedIds.add(match.id);
		items.push({
			kind: "genre",
			id: match.id,
			name: match.name,
			listingKind,
		});
	}

	const leftovers = genres
		.filter((genre) => !usedIds.has(genre.id))
		.slice()
		.sort((a, b) => a.name.localeCompare(b.name));
	for (const genre of leftovers) {
		items.push({
			kind: "genre",
			id: genre.id,
			name: genre.name,
			listingKind,
		});
	}

	return items;
}
