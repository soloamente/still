import { describe, expect, test } from "bun:test";

import {
	encodeRealtimeSseMessage,
	encodeSseData,
	encodeSseKeepalive,
	parseRealtimeSseMessage,
	parseStreamEntryData,
	roomIdFromStreamKey,
} from "@/lib/realtime-sse";

describe("realtime-sse", () => {
	test("encodeSseData produces double-newline terminated data frame", () => {
		const frame = encodeSseData({ type: "notification.created", id: "ntf_1" });
		expect(frame.startsWith("data: ")).toBe(true);
		expect(frame.endsWith("\n\n")).toBe(true);
		expect(JSON.parse(frame.slice(6, -2))).toEqual({
			type: "notification.created",
			id: "ntf_1",
		});
	});

	test("encodeSseKeepalive is a comment frame", () => {
		const frame = encodeSseKeepalive();
		expect(frame.startsWith(": keepalive ")).toBe(true);
		expect(frame.endsWith("\n\n")).toBe(true);
	});

	test("encodeRealtimeSseMessage wraps room + event", () => {
		const frame = encodeRealtimeSseMessage("user:usr_1:inbox", {
			type: "notification.created",
			notificationId: "ntf_1",
			kind: "review.like",
		});
		expect(parseRealtimeSseMessage(JSON.parse(frame.slice(6, -2)))).toEqual({
			room: "user:usr_1:inbox",
			event: {
				type: "notification.created",
				notificationId: "ntf_1",
				kind: "review.like",
			},
		});
	});

	test("parseRealtimeSseMessage rejects invalid payloads", () => {
		expect(parseRealtimeSseMessage(null)).toBeNull();
		expect(
			parseRealtimeSseMessage({ room: "x", event: { type: "nope" } }),
		).toBeNull();
	});

	test("roomIdFromStreamKey strips sense prefix", () => {
		expect(roomIdFromStreamKey("sense:stream:user:usr_1:inbox")).toBe(
			"user:usr_1:inbox",
		);
		expect(roomIdFromStreamKey("other:stream:x")).toBeNull();
	});

	test("parseStreamEntryData parses JSON strings", () => {
		expect(parseStreamEntryData('{"type":"comment.created"}')).toEqual({
			type: "comment.created",
		});
	});

	test("parseStreamEntryData unwraps nested data field", () => {
		expect(
			parseStreamEntryData({
				data: JSON.stringify({ type: "reaction.updated" }),
			}),
		).toEqual({ type: "reaction.updated" });
	});

	test("parseStreamEntryData accepts Upstash-deserialized event objects", () => {
		expect(
			parseStreamEntryData({
				data: {
					type: "comment.created",
					commentId: "cmt_1",
					preview: "Hello",
				},
			}),
		).toEqual({
			type: "comment.created",
			commentId: "cmt_1",
			preview: "Hello",
		});
	});

	test("parseStreamEntryData returns null for invalid JSON", () => {
		expect(parseStreamEntryData("{not json")).toBeNull();
		expect(parseStreamEntryData(null)).toBeNull();
	});
});
