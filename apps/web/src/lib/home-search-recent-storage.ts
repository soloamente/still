import type { SearchDialogStudio } from "@/lib/search-dialog-studios";
import {
	type ParseRecentOptions,
	parseRecentStructuredQuery,
	type SearchTag,
	serializeStructuredQuery,
} from "@/lib/search-query-tags";

/** Browser key for recent home-bar searches (shared with nothing else). */
export const HOME_SEARCH_RECENT_STORAGE_KEY = "still.home-search-recent";

export const HOME_SEARCH_RECENT_MAX = 10;

/** v2 rows keep tag ids so locale changes do not break genre round-trip. */
export type RecentSearchEntryV2 = {
	v: 2;
	/** Human chip label (`A24 · Terror · marty`). */
	label: string;
	tags: SearchTag[];
	freeText: string;
};

function isSearchTag(value: unknown): value is SearchTag {
	if (!value || typeof value !== "object") return false;
	const k = (value as SearchTag).kind;
	if (k === "lists") return true;
	if (k === "studio") {
		const s = value as Extract<SearchTag, { kind: "studio" }>;
		return typeof s.id === "number" && typeof s.name === "string";
	}
	if (k === "media") {
		const m = value as Extract<SearchTag, { kind: "media" }>;
		return m.listingKind === "movie" || m.listingKind === "tv";
	}
	if (k === "genre") {
		const g = value as Extract<SearchTag, { kind: "genre" }>;
		return (
			typeof g.id === "number" &&
			typeof g.name === "string" &&
			(g.listingKind === "movie" || g.listingKind === "tv")
		);
	}
	if (k === "curated") {
		const c = value as Extract<SearchTag, { kind: "curated" }>;
		return typeof c.slug === "string" && typeof c.label === "string";
	}
	return false;
}

function isRecentEntryV2(value: unknown): value is RecentSearchEntryV2 {
	if (!value || typeof value !== "object") return false;
	const row = value as RecentSearchEntryV2;
	return (
		row.v === 2 &&
		typeof row.label === "string" &&
		typeof row.freeText === "string" &&
		Array.isArray(row.tags) &&
		row.tags.every(isSearchTag)
	);
}

/** Refresh genre pill labels from the patron's current TMDb genre lists. */
export function refreshRecentSearchTagLabels(
	tags: SearchTag[],
	options: ParseRecentOptions,
): SearchTag[] {
	const movieGenres = options.movieGenres ?? [];
	const tvGenres = options.tvGenres ?? [];
	return tags.map((tag) => {
		if (tag.kind !== "genre") return tag;
		const list = tag.listingKind === "movie" ? movieGenres : tvGenres;
		const hit = list.find((g) => g.id === tag.id);
		return hit ? { ...tag, name: hit.name } : tag;
	});
}

function migrateLegacyRecentString(
	raw: string,
	studios: SearchDialogStudio[],
	options: ParseRecentOptions,
): RecentSearchEntryV2 {
	const parsed = parseRecentStructuredQuery(raw, studios, options);
	const tags = refreshRecentSearchTagLabels(parsed.tags, options);
	return {
		v: 2,
		label: serializeStructuredQuery(tags, parsed.freeText),
		tags,
		freeText: parsed.freeText,
	};
}

function canUseHomeSearchRecentStorage(): boolean {
	return typeof localStorage !== "undefined";
}

/** Read recents from localStorage (migrates legacy string rows on read). */
export function readHomeSearchRecents(
	studios: SearchDialogStudio[] = [],
	options: ParseRecentOptions = {},
): RecentSearchEntryV2[] {
	if (!canUseHomeSearchRecentStorage()) return [];
	try {
		const raw = localStorage.getItem(HOME_SEARCH_RECENT_STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		const out: RecentSearchEntryV2[] = [];
		for (const item of parsed) {
			if (typeof item === "string") {
				const trimmed = item.trim();
				if (!trimmed) continue;
				out.push(migrateLegacyRecentString(trimmed, studios, options));
				continue;
			}
			if (isRecentEntryV2(item)) {
				out.push({
					...item,
					tags: refreshRecentSearchTagLabels(item.tags, options),
					label: serializeStructuredQuery(
						refreshRecentSearchTagLabels(item.tags, options),
						item.freeText,
					),
				});
			}
		}
		return out.slice(0, HOME_SEARCH_RECENT_MAX);
	} catch {
		return [];
	}
}

export function persistHomeSearchRecents(next: RecentSearchEntryV2[]): void {
	if (!canUseHomeSearchRecentStorage()) return;
	try {
		localStorage.setItem(
			HOME_SEARCH_RECENT_STORAGE_KEY,
			JSON.stringify(next.slice(0, HOME_SEARCH_RECENT_MAX)),
		);
	} catch {
		// Private mode / quota — ignore.
	}
}

/**
 * Dedupes by label (case-insensitive), promotes latest to front, persists v2 rows.
 */
export function recordHomeSearchRecent(
	tags: SearchTag[],
	freeText: string,
	studios: SearchDialogStudio[] = [],
	options: ParseRecentOptions = {},
): RecentSearchEntryV2[] {
	const refreshed = refreshRecentSearchTagLabels(tags, options);
	const trimmedText = freeText.trim();
	const label = serializeStructuredQuery(refreshed, trimmedText).trim();
	if (!label) return readHomeSearchRecents(studios, options);

	const entry: RecentSearchEntryV2 = {
		v: 2,
		label,
		tags: refreshed,
		freeText: trimmedText,
	};

	const prev = readHomeSearchRecents(studios, options);
	const next = [
		entry,
		...prev.filter((q) => q.label.toLowerCase() !== label.toLowerCase()),
	].slice(0, HOME_SEARCH_RECENT_MAX);
	persistHomeSearchRecents(next);
	return next;
}

/** Restore committed tags from a stored recent row (no string re-parse). */
export function restoreFromHomeSearchRecent(
	entry: RecentSearchEntryV2,
	options: ParseRecentOptions = {},
): { tags: SearchTag[]; freeText: string } {
	return {
		tags: refreshRecentSearchTagLabels(entry.tags, options),
		freeText: entry.freeText,
	};
}

/** Drop one recent row by label (case-insensitive) and persist the rest. */
export function removeHomeSearchRecent(
	label: string,
	studios: SearchDialogStudio[] = [],
	options: ParseRecentOptions = {},
): RecentSearchEntryV2[] {
	const trimmed = label.trim();
	if (!trimmed) return readHomeSearchRecents(studios, options);

	const prev = readHomeSearchRecents(studios, options);
	const next = prev.filter(
		(q) => q.label.toLowerCase() !== trimmed.toLowerCase(),
	);
	persistHomeSearchRecents(next);
	return next;
}
