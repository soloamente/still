import { describe, expect, test } from "bun:test";
import {
	isClientProductEventKind,
	isProductEventKind,
	PRODUCT_EVENT_KINDS,
} from "./product-event-kinds";

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

describe("liveblocks realtime kinds", () => {
	test("includes server-recorded realtime funnel kinds", () => {
		for (const kind of [
			"realtime.presence.join",
			"realtime.presence.leave",
			"realtime.list.coedit",
			"realtime.comment.received_live",
			"realtime.notification.push_received",
			"realtime.list.sync_conflict",
		]) {
			expect(PRODUCT_EVENT_KINDS).toContain(kind);
			expect(isProductEventKind(kind)).toBe(true);
		}
	});

	test("allows client-emitted presence and push kinds only", () => {
		for (const kind of [
			"realtime.presence.join",
			"realtime.presence.leave",
			"realtime.comment.received_live",
			"realtime.notification.push_received",
		]) {
			expect(isClientProductEventKind(kind)).toBe(true);
		}

		expect(isClientProductEventKind("realtime.list.coedit")).toBe(false);
		expect(isClientProductEventKind("realtime.list.sync_conflict")).toBe(false);
	});
});
