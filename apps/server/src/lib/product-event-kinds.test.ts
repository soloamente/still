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

describe("today on sense kinds", () => {
	const clientKinds = [
		"today.viewed",
		"today.pick.viewed",
		"today.pick.action",
		"today.week.viewed",
		"today.week.action",
		"today.circle.viewed",
		"today.circle.action",
		"rating.category_saved",
		"rating.category_skipped",
		"rating.suggestion_applied",
	];
	const serverKinds = [
		"recommendation.sent",
		"recommendation.opened",
		"recommendation.accepted",
		"recommendation.answered",
	];

	test("registers every Today, category, and recommendation kind", () => {
		for (const kind of [...clientKinds, ...serverKinds]) {
			expect(isProductEventKind(kind)).toBe(true);
		}
	});

	test("browser may emit Today + category kinds, never the recommendation funnel", () => {
		for (const kind of clientKinds) {
			expect(isClientProductEventKind(kind)).toBe(true);
		}
		// Funnel steps are recorded by the recommendation routes — clients can't inflate them.
		for (const kind of serverKinds) {
			expect(isClientProductEventKind(kind)).toBe(false);
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
