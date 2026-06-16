import { describe, expect, test } from "bun:test";

import {
	listRealtimeAccessFromViewer,
	parseListRoomId,
	parseReviewRoomId,
	parseUserInboxRoomId,
	resolveRealtimeRoomAccess,
	resolveStaticRealtimeRoomAccess,
} from "@/lib/realtime-room-access";

describe("realtime-room-access", () => {
	test("listing movie room allows any signed-in patron", () => {
		expect(
			resolveStaticRealtimeRoomAccess("usr_self", "listing:movie:550"),
		).toBe("allow");
	});

	test("listing tv room allows any signed-in patron", () => {
		expect(resolveStaticRealtimeRoomAccess("usr_self", "listing:tv:1396")).toBe(
			"allow",
		);
	});

	test("patron app presence room allows any signed-in patron", () => {
		expect(resolveStaticRealtimeRoomAccess("usr_self", "patron:app")).toBe(
			"allow",
		);
	});

	test("inbox room allows only the owner", () => {
		expect(
			resolveStaticRealtimeRoomAccess("usr_self", "user:usr_self:inbox"),
		).toBe("allow");
		expect(
			resolveStaticRealtimeRoomAccess("usr_self", "user:usr_other:inbox"),
		).toBe("deny");
	});

	test("parses list, review, and inbox room ids", () => {
		expect(parseListRoomId("list:lst_1")).toBe("lst_1");
		expect(parseReviewRoomId("review:rev_1")).toBe("rev_1");
		expect(parseUserInboxRoomId("user:usr_1:inbox")).toBe("usr_1");
	});

	test("list editors receive write access; viewers read-only", () => {
		expect(listRealtimeAccessFromViewer(true)).toBe("allow");
		expect(listRealtimeAccessFromViewer(false)).toBe("read");
		expect(listRealtimeAccessFromViewer(undefined)).toBe("read");
	});

	test("list room write only when viewerCanEdit", async () => {
		await expect(
			resolveRealtimeRoomAccess("usr_self", "list:lst_1", {
				fetchListAccess: async () => "allow",
			}),
		).resolves.toBe("allow");

		await expect(
			resolveRealtimeRoomAccess("usr_self", "list:lst_1", {
				fetchListAccess: async () => "read",
			}),
		).resolves.toBe("read");

		await expect(
			resolveRealtimeRoomAccess("usr_self", "list:lst_private", {
				fetchListAccess: async () => "deny",
			}),
		).resolves.toBe("deny");
	});

	test("review room resolves to read when visible", async () => {
		await expect(
			resolveRealtimeRoomAccess("usr_self", "review:rev_1", {
				fetchReviewAccess: async () => "read",
			}),
		).resolves.toBe("read");
	});

	test("unknown rooms are denied", async () => {
		expect(resolveStaticRealtimeRoomAccess("usr_self", "chat:thr_1")).toBe(
			"deny",
		);
		await expect(
			resolveRealtimeRoomAccess("usr_self", "unknown:room"),
		).resolves.toBe("deny");
	});
});
