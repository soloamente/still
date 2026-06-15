import { describe, expect, test } from "bun:test";
import { isProductEventKind, PRODUCT_EVENT_KINDS } from "./product-event-kinds";

describe("letterboxd pillar kinds", () => {
	test("includes showcase and wrapped kinds", () => {
		for (const kind of [
			"showcase.edited",
			"post_log.celebrate",
			"viral_review.tapped",
			"journal.read",
			"wrapped.viewed",
			"wrapped.shared",
			"members.followed",
			"streaming_alert.sent",
			"quote.upvote",
			"quote.save",
			"quote.unsave",
			"quote.submit",
		]) {
			expect(PRODUCT_EVENT_KINDS).toContain(kind);
			expect(isProductEventKind(kind)).toBe(true);
		}
	});
});
