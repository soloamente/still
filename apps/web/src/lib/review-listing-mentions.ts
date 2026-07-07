/**
 * Back-compat re-exports for film/TV listing mentions.
 * New code should import from `@/lib/content-mentions`.
 */

import {
	type ContentMentionPart,
	formatListingMention,
	getActiveListingMentionQuery,
	insertListingMention,
	listingMentionPickerSubtitle,
	parseBodyWithMentions,
} from "@/lib/content-mentions";

export type ReviewListingMentionPart =
	| { type: "text"; value: string }
	| {
			type: "mention";
			label: string;
			href: `/movies/${number}` | `/tv/${number}`;
			listingKind: "movie" | "tv";
	  };

export {
	getActiveListingMentionQuery,
	insertListingMention as insertReviewListingMention,
	listingMentionPickerSubtitle,
};

export function formatReviewListingMention(input: {
	title: string;
	listingKind: "movie" | "tv";
	tmdbId: number;
}): string {
	return formatListingMention(input);
}

/** Maps unified `listing` parts to legacy `mention` for existing renderers. */
function toLegacyListingParts(
	parts: ContentMentionPart[],
): ReviewListingMentionPart[] {
	return parts.map((part) => {
		if (part.type === "text") return part;
		if (part.type === "listing") {
			return {
				type: "mention",
				label: part.label,
				href: part.href,
				listingKind: part.listingKind,
			};
		}
		// Person/patron tokens stay plain text until Task 2 renderer ships.
		return { type: "text", value: part.label };
	});
}

export function parseReviewBodyWithMentions(
	body: string,
): ReviewListingMentionPart[] {
	return toLegacyListingParts(parseBodyWithMentions(body));
}
