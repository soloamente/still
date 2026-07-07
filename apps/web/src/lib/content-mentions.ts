/**
 * Inline tags in review/comment copy — markdown links with path-based kind:
 * `#[Dune](/movies/9664)` · `@[Tim](/people/123)` · `@[Jane](/profile/handle)`.
 * Legacy `@[Title](/movies|tv/id)` listing tokens still parse as listings.
 */

export type ContentMentionPart =
	| { type: "text"; value: string }
	| {
			type: "listing";
			label: string;
			href: `/movies/${number}` | `/tv/${number}`;
			listingKind: "movie" | "tv";
	  }
	| {
			type: "person";
			label: string;
			href: `/people/${number}`;
			tmdbPersonId: number;
	  }
	| {
			type: "patron";
			label: string;
			href: `/profile/${string}`;
			handle: string;
	  };

/** Matches `#` or `@` markdown link tokens for listings, people, and patrons. */
const MENTION_TOKEN =
	/(#|@)\[([^\]]+)\]\(\/(movies|tv|people|profile)\/([^)]+)\)/g;

export function formatListingMention(input: {
	title: string;
	listingKind: "movie" | "tv";
	tmdbId: number;
}): string {
	const segment = input.listingKind === "movie" ? "movies" : "tv";
	// Strip brackets so the stored token stays parseable.
	const label = input.title.replace(/[[\]]/g, "").trim();
	return `#[${label}](/${segment}/${input.tmdbId})`;
}

export function formatPersonMention(input: {
	name: string;
	tmdbPersonId: number;
}): string {
	const label = input.name.replace(/[[\]]/g, "").trim();
	return `@[${label}](/people/${input.tmdbPersonId})`;
}

export function formatPatronMention(input: {
	displayName: string;
	handle: string;
}): string {
	const label = input.displayName.replace(/[[\]]/g, "").trim();
	return `@[${label}](/profile/${input.handle})`;
}

/** Subtitle line for the composer `#` picker — kind label plus release year when TMDb has one. */
export function listingMentionPickerSubtitle(input: {
	listingKind: "movie" | "tv";
	release_date?: string;
	first_air_date?: string;
}): string {
	const kindLabel = input.listingKind === "movie" ? "Film" : "TV show";
	const rawDate =
		input.listingKind === "movie" ? input.release_date : input.first_air_date;
	const year = rawDate?.trim().slice(0, 4);
	return year ? `${kindLabel} · ${year}` : kindLabel;
}

export function parseBodyWithMentions(body: string): ContentMentionPart[] {
	if (!body) return [{ type: "text", value: "" }];

	const parts: ContentMentionPart[] = [];
	let lastIndex = 0;

	for (const match of body.matchAll(MENTION_TOKEN)) {
		const full = match[0];
		const trigger = match[1];
		const label = match[2];
		const segment = match[3];
		const idPart = match[4];
		const index = match.index ?? 0;

		if (index > lastIndex) {
			parts.push({ type: "text", value: body.slice(lastIndex, index) });
		}

		if (segment === "movies" || segment === "tv") {
			// New `#` listings and legacy `@` listings share the same path shape.
			if (trigger === "#" || trigger === "@") {
				const tmdbId = Number(idPart);
				const listingKind = segment === "movies" ? "movie" : "tv";
				parts.push({
					type: "listing",
					label,
					href:
						listingKind === "movie"
							? (`/movies/${tmdbId}` as const)
							: (`/tv/${tmdbId}` as const),
					listingKind,
				});
			}
		} else if (segment === "people") {
			parts.push({
				type: "person",
				label,
				href: `/people/${Number(idPart)}`,
				tmdbPersonId: Number(idPart),
			});
		} else if (segment === "profile") {
			parts.push({
				type: "patron",
				label,
				href: `/profile/${idPart}`,
				handle: idPart,
			});
		}

		lastIndex = index + full.length;
	}

	if (lastIndex < body.length) {
		parts.push({ type: "text", value: body.slice(lastIndex) });
	}

	return parts.length > 0 ? parts : [{ type: "text", value: body }];
}

/** Active `#` typeahead — returns null when not tagging a film/TV title. */
export function getActiveListingMentionQuery(
	body: string,
	cursor: number,
): { query: string; start: number; end: number } | null {
	if (cursor < 1) return null;
	const before = body.slice(0, cursor);
	// Only start a mention after whitespace or at the start; stop once markdown starts.
	const match = before.match(/(?:^|[\s\n])#([^\s#[\]()]{0,80})$/);
	if (!match) return null;

	const query = match[1] ?? "";
	if (query.includes("[") || query.includes("]")) return null;

	const leadingWhitespace = match[0].startsWith("#") ? 0 : 1;
	const start = before.length - match[0].length + leadingWhitespace;
	return { query, start, end: cursor };
}

/** Active `@` typeahead — returns null when not tagging a person or patron. */
export function getActivePeopleMentionQuery(
	body: string,
	cursor: number,
): { query: string; start: number; end: number } | null {
	if (cursor < 1) return null;
	const before = body.slice(0, cursor);
	const match = before.match(/(?:^|[\s\n])@([^\s@[\]()]{0,80})$/);
	if (!match) return null;

	const query = match[1] ?? "";
	if (query.includes("[") || query.includes("]")) return null;

	const leadingWhitespace = match[0].startsWith("@") ? 0 : 1;
	const start = before.length - match[0].length + leadingWhitespace;
	return { query, start, end: cursor };
}

/** Handle-like `@` query → patron search; otherwise cast/crew people search. */
export function isPatronMentionQuery(rawQuery: string): boolean {
	const query = rawQuery.trim().replace(/^@+/, "");
	if (!query || /\s/.test(query)) return false;
	return /^[a-z0-9_]{1,30}$/i.test(query);
}

/** Rewrite legacy listing `@` tokens to `#` on save — leaves people/patron tokens unchanged. */
export function migrateLegacyListingMentions(body: string): string {
	return body.replace(
		/@\[([^\]]+)\]\(\/(movies|tv)\/(\d+)\)/g,
		"#[$1](/$2/$3)",
	);
}

export function insertListingMention(
	body: string,
	range: { start: number; end: number },
	mention: { title: string; listingKind: "movie" | "tv"; tmdbId: number },
): { nextBody: string; nextCursor: number } {
	const token = formatListingMention(mention);
	const needsLeadingSpace =
		range.start > 0 && !/\s/.test(body.charAt(range.start - 1));
	const prefix = needsLeadingSpace ? " " : "";
	const nextBody =
		body.slice(0, range.start) + prefix + token + body.slice(range.end);
	const nextCursor = range.start + prefix.length + token.length;
	return { nextBody, nextCursor };
}

export function insertPersonMention(
	body: string,
	range: { start: number; end: number },
	mention: { name: string; tmdbPersonId: number },
): { nextBody: string; nextCursor: number } {
	const token = formatPersonMention(mention);
	const needsLeadingSpace =
		range.start > 0 && !/\s/.test(body.charAt(range.start - 1));
	const prefix = needsLeadingSpace ? " " : "";
	const nextBody =
		body.slice(0, range.start) + prefix + token + body.slice(range.end);
	const nextCursor = range.start + prefix.length + token.length;
	return { nextBody, nextCursor };
}

export function insertPatronMention(
	body: string,
	range: { start: number; end: number },
	mention: { displayName: string; handle: string },
): { nextBody: string; nextCursor: number } {
	const token = formatPatronMention(mention);
	const needsLeadingSpace =
		range.start > 0 && !/\s/.test(body.charAt(range.start - 1));
	const prefix = needsLeadingSpace ? " " : "";
	const nextBody =
		body.slice(0, range.start) + prefix + token + body.slice(range.end);
	const nextCursor = range.start + prefix.length + token.length;
	return { nextBody, nextCursor };
}
