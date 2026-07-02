import { describe, expect, test } from "bun:test";

import {
	appendViewerSelfPresence,
	mergeVisiblePatronPresence,
	normalizePatronOnlineHandleBatch,
	PATRON_ONLINE_HANDLE_BATCH_LIMIT,
	pickVisibleOnlineHandles,
	pickVisiblePresenceForViewer,
} from "./patron-presence";
import { PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC } from "./profile-media";

const VIEWER_ID = "viewer_1";

function row(
	overrides: Partial<{
		userId: string;
		handle: string;
		presenceVisibility: "friends" | "public";
		isMutualWithViewer: boolean;
	}>,
) {
	return {
		userId: overrides.userId ?? "usr_2",
		handle: overrides.handle ?? "friend",
		preferences:
			overrides.presenceVisibility === "public"
				? {
						privacy: {
							presenceVisibility: PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC,
						},
					}
				: null,
		isMutualWithViewer: overrides.isMutualWithViewer ?? true,
	};
}

describe("pickVisibleOnlineHandles", () => {
	test("excludes the viewer's own handle", () => {
		const handles = pickVisibleOnlineHandles(
			VIEWER_ID,
			[row({ userId: VIEWER_ID, handle: "me" })],
			new Set([VIEWER_ID]),
		);
		expect(handles).toEqual([]);
	});

	test("friends-only patron is visible to mutual viewers when active", () => {
		const handles = pickVisibleOnlineHandles(
			VIEWER_ID,
			[
				row({
					userId: "usr_friend",
					handle: "friend",
					isMutualWithViewer: true,
				}),
			],
			new Set(["usr_friend"]),
		);
		expect(handles).toEqual(["friend"]);
	});

	test("friends-only patron is hidden from non-mutual viewers", () => {
		const handles = pickVisibleOnlineHandles(
			VIEWER_ID,
			[
				row({
					userId: "usr_stranger",
					handle: "stranger",
					isMutualWithViewer: false,
				}),
			],
			new Set(["usr_stranger"]),
		);
		expect(handles).toEqual([]);
	});

	test("public patron is visible to non-mutual viewers when active", () => {
		const handles = pickVisibleOnlineHandles(
			VIEWER_ID,
			[
				row({
					userId: "usr_public",
					handle: "public_patron",
					presenceVisibility: "public",
					isMutualWithViewer: false,
				}),
			],
			new Set(["usr_public"]),
		);
		expect(handles).toEqual(["public_patron"]);
	});

	test("inactive patrons are omitted even when visible", () => {
		const handles = pickVisibleOnlineHandles(
			VIEWER_ID,
			[row({ userId: "usr_friend", handle: "friend" })],
			new Set(),
		);
		expect(handles).toEqual([]);
	});
});

describe("appendViewerSelfPresence", () => {
	const VIEWER = "viewer_1";

	test("appends self when handle requested and active", () => {
		const result = appendViewerSelfPresence({
			viewerId: VIEWER,
			viewerHandle: "MeUser",
			requestedHandles: ["meuser", "friend"],
			activeUserIds: new Set([VIEWER]),
			activityByUserId: new Map([[VIEWER, "away"]]),
			presence: [],
		});
		expect(result).toEqual([{ handle: "meuser", state: "away" }]);
	});

	test("includes self when active even if only other handles were requested", () => {
		const result = appendViewerSelfPresence({
			viewerId: VIEWER,
			viewerHandle: "meuser",
			requestedHandles: ["friend"],
			activeUserIds: new Set([VIEWER]),
			activityByUserId: new Map(),
			presence: [],
		});
		expect(result).toEqual([{ handle: "meuser", state: "active" }]);
	});

	test("skips self when not heartbeat-active", () => {
		const result = appendViewerSelfPresence({
			viewerId: VIEWER,
			viewerHandle: "meuser",
			requestedHandles: ["meuser"],
			activeUserIds: new Set(),
			activityByUserId: new Map(),
			presence: [],
		});
		expect(result).toEqual([]);
	});

	test("does not duplicate when already present", () => {
		const result = appendViewerSelfPresence({
			viewerId: VIEWER,
			viewerHandle: "meuser",
			requestedHandles: ["meuser"],
			activeUserIds: new Set([VIEWER]),
			activityByUserId: new Map([[VIEWER, "active"]]),
			presence: [{ handle: "meuser", state: "active" }],
		});
		expect(result).toEqual([{ handle: "meuser", state: "active" }]);
	});
});

describe("pickVisiblePresenceForViewer", () => {
	test("returns away state when activity map says away", () => {
		const presence = pickVisiblePresenceForViewer(
			VIEWER_ID,
			[
				row({
					userId: "usr_friend",
					handle: "friend",
					isMutualWithViewer: true,
				}),
			],
			new Set(["usr_friend"]),
			new Map([["usr_friend", "away"]]),
		);
		expect(presence).toEqual([{ handle: "friend", state: "away" }]);
	});

	test("defaults missing activity to active", () => {
		const presence = pickVisiblePresenceForViewer(
			VIEWER_ID,
			[
				row({
					userId: "usr_friend",
					handle: "friend",
					isMutualWithViewer: true,
				}),
			],
			new Set(["usr_friend"]),
		);
		expect(presence).toEqual([{ handle: "friend", state: "active" }]);
	});
});

describe("normalizePatronOnlineHandleBatch", () => {
	test("dedupes and lowercases handles", () => {
		expect(
			normalizePatronOnlineHandleBatch(["Alice", " alice ", "BOB", "bob"]),
		).toEqual(["alice", "bob"]);
	});

	test("caps batch size", () => {
		const handles = Array.from(
			{ length: PATRON_ONLINE_HANDLE_BATCH_LIMIT + 5 },
			(_, index) => `patron_${index}`,
		);
		expect(normalizePatronOnlineHandleBatch(handles)).toHaveLength(
			PATRON_ONLINE_HANDLE_BATCH_LIMIT,
		);
	});
});

describe("mergeVisiblePatronPresence", () => {
	test("fills Redis-only rows when worker list is empty", () => {
		const redis = [{ handle: "me", state: "active" as const }];
		expect(mergeVisiblePatronPresence([], redis)).toEqual(redis);
	});

	test("worker row wins on duplicate handle", () => {
		const merged = mergeVisiblePatronPresence(
			[{ handle: "friend", state: "away" }],
			[{ handle: "friend", state: "active" }],
		);
		expect(merged).toEqual([{ handle: "friend", state: "away" }]);
	});

	test("unions distinct handles from both sources", () => {
		const merged = mergeVisiblePatronPresence(
			[{ handle: "worker", state: "active" }],
			[{ handle: "redis", state: "away" }],
		);
		expect(merged).toEqual([
			{ handle: "redis", state: "away" },
			{ handle: "worker", state: "active" },
		]);
	});
});
