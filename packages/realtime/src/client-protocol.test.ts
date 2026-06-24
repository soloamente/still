import { describe, expect, test } from "bun:test";
import { parseClientFrame, parseServerFrame } from "./client-protocol";
import {
	classifyRoom,
	parseChatRoomId,
	parseListRoomId,
	parseReviewRoomId,
	parseUserInboxRoomId,
} from "./room-ids";

describe("parseClientFrame", () => {
	test("join frame", () => {
		const frame = parseClientFrame(
			JSON.stringify({ kind: "join", room: "listing:movie:123" }),
		);
		expect(frame).toEqual({ kind: "join", room: "listing:movie:123" });
	});

	test("leave frame", () => {
		const frame = parseClientFrame(
			JSON.stringify({ kind: "leave", room: "patron:app" }),
		);
		expect(frame).toEqual({ kind: "leave", room: "patron:app" });
	});

	test("heartbeat frame defaults activityState to active", () => {
		const frame = parseClientFrame(
			JSON.stringify({ kind: "heartbeat", room: "patron:app" }),
		);
		expect(frame).toEqual({
			kind: "heartbeat",
			room: "patron:app",
			activityState: "active",
		});
	});

	test("heartbeat frame away", () => {
		const frame = parseClientFrame(
			JSON.stringify({
				kind: "heartbeat",
				room: "patron:app",
				activityState: "away",
			}),
		);
		expect(frame?.kind === "heartbeat" && frame.activityState).toBe("away");
	});

	test("ping frame", () => {
		expect(parseClientFrame(JSON.stringify({ kind: "ping" }))).toEqual({
			kind: "ping",
		});
	});

	test("unknown kind returns null", () => {
		expect(parseClientFrame(JSON.stringify({ kind: "unknown" }))).toBeNull();
	});

	test("malformed JSON returns null", () => {
		expect(parseClientFrame("not-json")).toBeNull();
	});
});

describe("parseServerFrame", () => {
	test("event frame", () => {
		const frame = parseServerFrame(
			JSON.stringify({
				kind: "event",
				room: "patron:app",
				event: { type: "presence.updated" },
			}),
		);
		expect(frame).toMatchObject({ kind: "event", room: "patron:app" });
	});

	test("pong frame", () => {
		expect(parseServerFrame(JSON.stringify({ kind: "pong" }))).toEqual({
			kind: "pong",
		});
	});
});

describe("classifyRoom", () => {
	test("listing rooms are allow", () => {
		expect(classifyRoom("listing:movie:123").tier).toBe("allow");
		expect(classifyRoom("listing:tv:456").tier).toBe("allow");
	});

	test("patron:app is allow", () => {
		expect(classifyRoom("patron:app").tier).toBe("allow");
	});

	test("user inbox is self", () => {
		const result = classifyRoom("user:usr_123:inbox");
		expect(result.tier).toBe("self");
		expect(result.ownerUserId).toBe("usr_123");
	});

	test("chat rooms are dynamic", () => {
		expect(classifyRoom("chat:thr_abc").tier).toBe("dynamic");
	});

	test("review rooms are dynamic", () => {
		expect(classifyRoom("review:rev_xyz").tier).toBe("dynamic");
	});

	test("list rooms are dynamic", () => {
		expect(classifyRoom("list:lst_qrs").tier).toBe("dynamic");
	});

	test("unknown rooms are deny", () => {
		expect(classifyRoom("staff:plans").tier).toBe("deny");
		expect(classifyRoom("unknown:whatever").tier).toBe("deny");
	});
});

describe("room id parsers", () => {
	test("parseUserInboxRoomId", () => {
		expect(parseUserInboxRoomId("user:usr_1:inbox")).toBe("usr_1");
		expect(parseUserInboxRoomId("user:usr_1:other")).toBeNull();
	});

	test("parseChatRoomId", () => {
		expect(parseChatRoomId("chat:thr_1")).toBe("thr_1");
		expect(parseChatRoomId("other:thr_1")).toBeNull();
	});

	test("parseReviewRoomId", () => {
		expect(parseReviewRoomId("review:rev_1")).toBe("rev_1");
	});

	test("parseListRoomId", () => {
		expect(parseListRoomId("list:lst_1")).toBe("lst_1");
	});
});
