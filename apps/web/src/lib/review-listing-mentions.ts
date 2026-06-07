/**
 * Inline film/TV tags in review copy — stored as lightweight markdown links:
 * `@[Dune: Part Two](/movies/9664)` or `@[Breaking Bad](/tv/1396)`.
 */

export type ReviewListingMentionPart =
	| { type: "text"; value: string }
	| {
			type: "mention";
			label: string;
			href: `/movies/${number}` | `/tv/${number}`;
			listingKind: "movie" | "tv";
	  };

/** Matches `@[Title](/movies/123)` and `@[Title](/tv/456)` tokens in review bodies. */
const LISTING_MENTION_PATTERN = /@\[([^\]]+)\]\(\/(movies|tv)\/(\d+)\)/g;

export function formatReviewListingMention(input: {
	title: string;
	listingKind: "movie" | "tv";
	tmdbId: number;
}): string {
	const segment = input.listingKind === "movie" ? "movies" : "tv";
	const href = `/${segment}/${input.tmdbId}`;
	// Strip brackets so the stored token stays parseable.
	const label = input.title.replace(/[[\]]/g, "").trim();
	return `@[${label}](${href})`;
}

/** Subtitle line for the composer `@` picker — kind label plus release year when TMDb has one. */
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

export function parseReviewBodyWithMentions(
	body: string,
): ReviewListingMentionPart[] {
	if (!body) return [{ type: "text", value: "" }];

	const parts: ReviewListingMentionPart[] = [];
	let lastIndex = 0;

	for (const match of body.matchAll(LISTING_MENTION_PATTERN)) {
		const full = match[0];
		const label = match[1];
		const segment = match[2];
		const tmdbId = Number(match[3]);
		const listingKind = segment === "movies" ? "movie" : "tv";
		const href =
			listingKind === "movie"
				? (`/movies/${tmdbId}` as const)
				: (`/tv/${tmdbId}` as const);
		const index = match.index ?? 0;

		if (index > lastIndex) {
			parts.push({ type: "text", value: body.slice(lastIndex, index) });
		}

		parts.push({ type: "mention", label, href, listingKind });
		lastIndex = index + full.length;
	}

	if (lastIndex < body.length) {
		parts.push({ type: "text", value: body.slice(lastIndex) });
	}

	return parts.length > 0 ? parts : [{ type: "text", value: body }];
}

/** Active `@` typeahead — returns null when not tagging a title. */
export function getActiveListingMentionQuery(
	body: string,
	cursor: number,
): { query: string; start: number; end: number } | null {
	if (cursor < 1) return null;
	const before = body.slice(0, cursor);
	// Only start a mention after whitespace or at the start; stop once markdown starts.
	const match = before.match(/(?:^|[\s\n])@([^\s@[\]()]{0,80})$/);
	if (!match) return null;

	const query = match[1] ?? "";
	if (query.includes("[") || query.includes("]")) return null;

	const leadingWhitespace = match[0].startsWith("@") ? 0 : 1;
	const start = before.length - match[0].length + leadingWhitespace;
	return { query, start, end: cursor };
}

export function insertReviewListingMention(
	body: string,
	range: { start: number; end: number },
	mention: { title: string; listingKind: "movie" | "tv"; tmdbId: number },
): { nextBody: string; nextCursor: number } {
	const token = formatReviewListingMention(mention);
	const needsLeadingSpace =
		range.start > 0 && !/\s/.test(body.charAt(range.start - 1));
	const prefix = needsLeadingSpace ? " " : "";
	const nextBody =
		body.slice(0, range.start) + prefix + token + body.slice(range.end);
	const nextCursor = range.start + prefix.length + token.length;
	return { nextBody, nextCursor };
}
