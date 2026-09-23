/** Icon key for a genre/curated chip — maps copy to a Lucide glyph in the rail. */
export type SearchDialogGenreIconKey =
	| "fantasy"
	| "action"
	| "horror"
	| "romance"
	| "adventure"
	| "animation"
	| "anime"
	| "thriller"
	| "scifi"
	| "documentary"
	| "comedy"
	| "drama"
	| "crime"
	| "mystery"
	| "family"
	| "music"
	| "war"
	| "western"
	| "history"
	| "default";

const NAME_TO_KEY: ReadonlyArray<{
	key: SearchDialogGenreIconKey;
	names: readonly string[];
}> = [
	{ key: "fantasy", names: ["fantasy"] },
	{ key: "action", names: ["action"] },
	{ key: "horror", names: ["horror"] },
	{ key: "romance", names: ["romance"] },
	{ key: "adventure", names: ["adventure"] },
	{ key: "animation", names: ["animation"] },
	{ key: "anime", names: ["anime"] },
	{ key: "thriller", names: ["thriller"] },
	{
		key: "scifi",
		names: ["science fiction", "sci-fi", "sci-fi & fantasy"],
	},
	{ key: "documentary", names: ["documentary"] },
	{ key: "comedy", names: ["comedy"] },
	{ key: "drama", names: ["drama"] },
	{ key: "crime", names: ["crime"] },
	{ key: "mystery", names: ["mystery"] },
	{ key: "family", names: ["family"] },
	{ key: "music", names: ["music"] },
	{ key: "war", names: ["war"] },
	{ key: "western", names: ["western"] },
	{ key: "history", names: ["history"] },
];

/** Stable glyph id for a TMDb / curated genre label. */
export function searchDialogGenreIconKey(
	name: string,
): SearchDialogGenreIconKey {
	const needle = name.trim().toLowerCase();
	for (const row of NAME_TO_KEY) {
		if (row.names.includes(needle)) return row.key;
	}
	return "default";
}
