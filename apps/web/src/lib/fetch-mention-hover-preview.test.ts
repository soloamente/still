import { describe, expect, test } from "bun:test";

import type { ContentMentionPart } from "@/lib/content-mentions";
import { mentionHoverPreviewCacheKey } from "@/lib/mention-hover-preview-cache-key";

describe("mentionHoverPreviewCacheKey", () => {
	test("keys listing, person, and patron mentions separately", () => {
		const listing: ContentMentionPart = {
			type: "listing",
			label: "Marty Supreme",
			href: "/movies/123",
			listingKind: "movie",
		};
		const person: ContentMentionPart = {
			type: "person",
			label: "Timothée Chalamet",
			href: "/people/456",
			tmdbPersonId: 456,
		};
		const patron: ContentMentionPart = {
			type: "patron",
			label: "Anselmo",
			href: "/profile/adgv",
			handle: "adgv",
		};

		expect(mentionHoverPreviewCacheKey(listing)).toBe(
			"listing:movie:/movies/123",
		);
		expect(mentionHoverPreviewCacheKey(person)).toBe("person:456");
		expect(mentionHoverPreviewCacheKey(patron)).toBe("patron:adgv");
	});
});
