import type { ContentMentionPart } from "@/lib/content-mentions";

type MentionEntityPart = Exclude<ContentMentionPart, { type: "text" }>;

/** Stable cache key for deduping hover fetches across the same review body. */
export function mentionHoverPreviewCacheKey(part: MentionEntityPart): string {
	switch (part.type) {
		case "listing":
			return `listing:${part.listingKind}:${part.href}`;
		case "person":
			return `person:${part.tmdbPersonId}`;
		case "patron":
			return `patron:${part.handle.toLowerCase()}`;
		default: {
			const _exhaustive: never = part;
			return String(_exhaustive);
		}
	}
}
