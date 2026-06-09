import {
	curatedTagBySlug,
	findCuratedSuggestions,
	SEARCH_CURATED_TAGS,
} from "@/lib/search-curated-tags";
import {
	type SearchDialogStudio,
	studioNameMatchesToken,
	studioSearchTokens,
} from "@/lib/search-dialog-studios";

export type SearchDialogGenre = { id: number; name: string };

/** Committed filter chip in the home search token field. */
export type SearchTag =
	| { kind: "studio"; id: number; name: string; logoUrl: string | null }
	| { kind: "media"; listingKind: "movie" | "tv" }
	| { kind: "genre"; id: number; name: string; listingKind: "movie" | "tv" }
	| { kind: "curated"; slug: string; label: string }
	| { kind: "lists" };

/** One row in the Tab-completion menu. */
export type TagSuggestion =
	| {
			kind: "studio";
			id: number;
			name: string;
			logoUrl: string | null;
			label: string;
	  }
	| { kind: "media"; listingKind: "movie" | "tv"; label: string }
	| {
			kind: "genre";
			id: number;
			name: string;
			listingKind: "movie" | "tv";
			label: string;
	  }
	| { kind: "curated"; slug: string; label: string }
	| { kind: "lists"; label: string };

const MEDIA_MOVIE = ["movie", "movies", "film", "films"] as const;
const MEDIA_TV = ["tv", "show", "shows"] as const;
const LISTS = ["list", "lists"] as const;

/** Prefix, substring, or word-start match for TMDb genre names in the token field. */
export function genreNameMatchesToken(name: string, token: string): boolean {
	const q = token.trim().toLowerCase();
	if (!q) return false;
	const lower = name.toLowerCase();
	if (lower.startsWith(q)) return true;
	if (q.length >= 2 && lower.includes(q)) return true;
	return lower
		.split(/[\s&/+-]+/)
		.some((word) => word.length > 0 && word.startsWith(q));
}

/** Stable React key for a committed tag pill. */
export function searchTagKey(tag: SearchTag): string {
	if (tag.kind === "studio") return `studio-${tag.id}`;
	if (tag.kind === "media") return `media-${tag.listingKind}`;
	if (tag.kind === "genre") return `genre-${tag.listingKind}-${tag.id}`;
	if (tag.kind === "curated") return `curated-${tag.slug}`;
	return "lists";
}

/** Derived catalogue mode from committed tags (used by search hooks). */
export function deriveSearchState(tags: SearchTag[]) {
	const studio = tags.find(
		(t): t is Extract<SearchTag, { kind: "studio" }> => t.kind === "studio",
	);
	const media = tags.find(
		(t): t is Extract<SearchTag, { kind: "media" }> => t.kind === "media",
	);
	const lists = tags.some((t) => t.kind === "lists");
	return {
		studioId: studio?.id ?? null,
		listingKind: (media?.listingKind ?? "movie") as "movie" | "tv",
		resultMode: lists ? ("lists" as const) : ("catalogue" as const),
	};
}

export type CatalogueFilterBundle = ReturnType<typeof deriveSearchState> & {
	genreIds: number[];
	keywordIds: number[];
};

/** Merge explicit genre pills + curated rules into TMDb discover AND params. */
export function deriveCatalogueFilterBundle(
	tags: SearchTag[],
	listingKindOverride?: "movie" | "tv",
): CatalogueFilterBundle {
	const base = deriveSearchState(tags);
	const hasMediaTag = tags.some((t) => t.kind === "media");
	const listingKind = hasMediaTag
		? base.listingKind
		: (listingKindOverride ?? base.listingKind);
	const genreIds: number[] = [];
	const keywordIds: number[] = [];

	for (const tag of tags) {
		if (tag.kind === "genre") {
			if (!genreIds.includes(tag.id)) genreIds.push(tag.id);
		}
		if (tag.kind === "curated") {
			const def = curatedTagBySlug(tag.slug);
			if (!def) continue;
			const rules = listingKind === "tv" ? def.tv : def.movie;
			for (const id of rules.genreIds) {
				if (!genreIds.includes(id)) genreIds.push(id);
			}
			for (const id of rules.keywordIds) {
				if (!keywordIds.includes(id)) keywordIds.push(id);
			}
		}
	}

	return { ...base, listingKind, genreIds, keywordIds };
}

/** Rank autocomplete rows for the active input token (prefix match). */
export function rankTagSuggestions(
	token: string,
	studios: SearchDialogStudio[],
	genres: SearchDialogGenre[],
	listingKind: "movie" | "tv",
	existingTags: SearchTag[],
): TagSuggestion[] {
	const q = token.trim().toLowerCase();
	if (!q) return [];

	const hasStudio = existingTags.some((t) => t.kind === "studio");
	const hasMedia = existingTags.some((t) => t.kind === "media");
	const hasLists = existingTags.some((t) => t.kind === "lists");
	const out: TagSuggestion[] = [];

	if (hasLists) return out;

	for (const s of studios) {
		if (hasStudio) continue;
		if (studioNameMatchesToken(s, token)) {
			out.push({
				kind: "studio",
				id: s.id,
				name: s.name,
				logoUrl: s.logoUrl,
				label: s.name,
			});
		}
	}

	for (const g of genres) {
		const committed = existingTags.some(
			(t) => t.kind === "genre" && t.id === g.id,
		);
		if (committed) continue;
		if (genreNameMatchesToken(g.name, token)) {
			out.push({
				kind: "genre",
				id: g.id,
				name: g.name,
				listingKind,
				label: g.name,
			});
		}
	}

	for (const c of findCuratedSuggestions(token)) {
		const committed = existingTags.some(
			(t) => t.kind === "curated" && t.slug === c.slug,
		);
		if (committed) continue;
		out.push({ kind: "curated", slug: c.slug, label: c.label });
	}

	if (!hasMedia) {
		if (MEDIA_MOVIE.some((w) => w.startsWith(q))) {
			out.push({ kind: "media", listingKind: "movie", label: "Films" });
		}
		if (MEDIA_TV.some((w) => w.startsWith(q))) {
			out.push({ kind: "media", listingKind: "tv", label: "TV shows" });
		}
	}

	if (LISTS.some((w) => w.startsWith(q))) {
		out.push({ kind: "lists", label: "Lists" });
	}

	return out.slice(0, 12);
}

export function suggestionToTag(suggestion: TagSuggestion): SearchTag {
	if (suggestion.kind === "studio") {
		return {
			kind: "studio",
			id: suggestion.id,
			name: suggestion.name,
			logoUrl: suggestion.logoUrl,
		};
	}
	if (suggestion.kind === "media") {
		return { kind: "media", listingKind: suggestion.listingKind };
	}
	if (suggestion.kind === "genre") {
		return {
			kind: "genre",
			id: suggestion.id,
			name: suggestion.name,
			listingKind: suggestion.listingKind,
		};
	}
	if (suggestion.kind === "curated") {
		return { kind: "curated", slug: suggestion.slug, label: suggestion.label };
	}
	return { kind: "lists" };
}

/** Insert or replace a tag; lists mode clears catalogue tags. */
export function upsertTag(tags: SearchTag[], next: SearchTag): SearchTag[] {
	if (next.kind === "lists") return [next];

	const withoutLists = tags.filter((t) => t.kind !== "lists");

	if (next.kind === "studio") {
		return [...withoutLists.filter((t) => t.kind !== "studio"), next];
	}
	if (next.kind === "media") {
		return [...withoutLists.filter((t) => t.kind !== "media"), next];
	}
	if (next.kind === "genre") {
		return [
			...withoutLists.filter(
				(t) =>
					!(
						t.kind === "genre" &&
						t.id === next.id &&
						t.listingKind === next.listingKind
					),
			),
			next,
		];
	}
	if (next.kind === "curated") {
		return [
			...withoutLists.filter(
				(t) => !(t.kind === "curated" && t.slug === next.slug),
			),
			next,
		];
	}

	return withoutLists;
}

/** Middle-dot separator for recent-search round-trip (tags then trailing free text). */
export const STRUCTURED_QUERY_SEP = " · ";

/** Stable `?search=` token — studio id survives without the curated studio list. */
function tagSegmentLabel(tag: SearchTag): string {
	if (tag.kind === "studio") return `studio:${tag.id}`;
	if (tag.kind === "media") {
		return tag.listingKind === "movie" ? "Films" : "TV shows";
	}
	if (tag.kind === "genre") return tag.name;
	if (tag.kind === "curated") return tag.label;
	return "Lists";
}

/** Patron-facing chip copy — names, not `studio:41077` tokens. */
export function displayTagSegmentLabel(tag: SearchTag): string {
	if (tag.kind === "studio") return tag.name;
	if (tag.kind === "media") {
		return tag.listingKind === "movie" ? "Films" : "TV shows";
	}
	if (tag.kind === "genre") return tag.name;
	if (tag.kind === "curated") return tag.label;
	return "Lists";
}

/** Persisted recent row: committed tags in order, then optional free-text token. */
export function serializeStructuredQuery(
	tags: SearchTag[],
	freeText: string,
): string {
	const segments: string[] = [];
	for (const tag of tags) {
		segments.push(tagSegmentLabel(tag));
	}
	const ft = freeText.trim();
	if (ft) segments.push(ft);
	return segments.join(STRUCTURED_QUERY_SEP);
}

export type ParsedRecentStructuredQuery = {
	tags: SearchTag[];
	freeText: string;
};

export type ParseRecentOptions = {
	movieGenres?: SearchDialogGenre[];
	tvGenres?: SearchDialogGenre[];
};

function findGenreByName(
	name: string,
	movieGenres: SearchDialogGenre[],
	tvGenres: SearchDialogGenre[],
): SearchTag | null {
	const lower = name.toLowerCase();
	for (const g of movieGenres) {
		if (g.name.toLowerCase() === lower) {
			return { kind: "genre", id: g.id, name: g.name, listingKind: "movie" };
		}
	}
	for (const g of tvGenres) {
		if (g.name.toLowerCase() === lower) {
			return { kind: "genre", id: g.id, name: g.name, listingKind: "tv" };
		}
	}
	return null;
}

/** Parses middle-dot segments into tags + trailing free text. */
function parseStructuredQuerySegments(
	segments: string[],
	studios: SearchDialogStudio[],
	options: ParseRecentOptions,
): ParsedRecentStructuredQuery {
	const movieGenres = options.movieGenres ?? [];
	const tvGenres = options.tvGenres ?? [];
	const tags: SearchTag[] = [];
	let freeText = "";

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		if (!seg) continue;
		const lower = seg.toLowerCase();

		if (!tags.some((t) => t.kind === "studio")) {
			// Stable committed-search token — parses before `/api/movies/studios` hydrates.
			const studioIdMatch = /^studio:(\d+)$/i.exec(seg);
			if (studioIdMatch) {
				const id = Number(studioIdMatch[1]);
				if (Number.isFinite(id) && id > 0) {
					const known = studios.find((s) => s.id === id);
					tags.push({
						kind: "studio",
						id,
						name: known?.name ?? "Studio",
						logoUrl: known?.logoUrl ?? null,
					});
					continue;
				}
			}
			const studio = studios.find(
				(s) =>
					s.name.toLowerCase() === lower ||
					studioSearchTokens(s).some((t) => t === lower),
			);
			if (studio) {
				tags.push({
					kind: "studio",
					id: studio.id,
					name: studio.name,
					logoUrl: studio.logoUrl,
				});
				continue;
			}
		}

		if (!tags.some((t) => t.kind === "media")) {
			if (
				lower === "films" ||
				lower === "film" ||
				lower === "movies" ||
				lower === "movie"
			) {
				tags.push({ kind: "media", listingKind: "movie" });
				continue;
			}
			if (
				lower === "tv shows" ||
				lower === "tv" ||
				lower === "shows" ||
				lower === "show"
			) {
				tags.push({ kind: "media", listingKind: "tv" });
				continue;
			}
		}

		if (
			!tags.some((t) => t.kind === "lists") &&
			(lower === "lists" || lower === "list")
		) {
			tags.push({ kind: "lists" });
			continue;
		}

		const curated = SEARCH_CURATED_TAGS.find(
			(c) => c.label.toLowerCase() === lower,
		);
		if (
			curated &&
			!tags.some((t) => t.kind === "curated" && t.slug === curated.slug)
		) {
			tags.push({ kind: "curated", slug: curated.slug, label: curated.label });
			continue;
		}

		const genreTag = findGenreByName(seg, movieGenres, tvGenres);
		if (genreTag?.kind === "genre") {
			const committed = tags.some(
				(t) =>
					t.kind === "genre" &&
					t.id === genreTag.id &&
					t.listingKind === genreTag.listingKind,
			);
			if (!committed) {
				tags.push(genreTag);
				continue;
			}
		}

		freeText = segments.slice(i).join(STRUCTURED_QUERY_SEP);
		break;
	}

	return { tags, freeText };
}

/**
 * Restore tags + free text from a recent chip. Legacy rows without the separator
 * still try a single studio/genre/curated token before falling back to plain text.
 */
export function parseRecentStructuredQuery(
	raw: string,
	studios: SearchDialogStudio[],
	options: ParseRecentOptions = {},
): ParsedRecentStructuredQuery {
	const trimmed = raw.trim();
	if (!trimmed) return { tags: [], freeText: "" };

	const segments = trimmed.includes(STRUCTURED_QUERY_SEP)
		? trimmed
				.split(STRUCTURED_QUERY_SEP)
				.map((s) => s.trim())
				.filter(Boolean)
		: [trimmed];

	const parsed = parseStructuredQuerySegments(segments, studios, options);
	if (!trimmed.includes(STRUCTURED_QUERY_SEP) && parsed.tags.length === 0) {
		return { tags: [], freeText: trimmed };
	}
	return parsed;
}
