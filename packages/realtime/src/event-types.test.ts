import { describe, expect, test } from "bun:test";
import { parseRealtimeEvent } from "./event-types";

describe("event-types", () => {
	test("parses comment.created", () => {
		expect(
			parseRealtimeEvent({
				type: "comment.created",
				commentId: "cmt_1",
				preview: "Great take",
			}),
		).toEqual({
			type: "comment.created",
			commentId: "cmt_1",
			preview: "Great take",
		});
	});

	test("parses reaction.updated", () => {
		expect(
			parseRealtimeEvent({
				type: "reaction.updated",
				likesCount: 3,
				dislikesCount: 1,
			}),
		).toEqual({
			type: "reaction.updated",
			likesCount: 3,
			dislikesCount: 1,
		});
	});

	test("parses notification.created", () => {
		expect(
			parseRealtimeEvent({
				type: "notification.created",
				notificationId: "ntf_1",
				kind: "review.like",
			}),
		).toEqual({
			type: "notification.created",
			notificationId: "ntf_1",
			kind: "review.like",
		});
	});

	test("parses list.reordered", () => {
		expect(
			parseRealtimeEvent({
				type: "list.reordered",
				itemIds: ["lit_1", "lit_2"],
			}),
		).toEqual({
			type: "list.reordered",
			itemIds: ["lit_1", "lit_2"],
		});
	});

	test("parses presence.updated", () => {
		expect(parseRealtimeEvent({ type: "presence.updated" })).toEqual({
			type: "presence.updated",
		});
	});

	test("rejects unknown event shapes", () => {
		expect(parseRealtimeEvent({ type: "unknown" })).toBeNull();
		expect(parseRealtimeEvent(null)).toBeNull();
	});
});
