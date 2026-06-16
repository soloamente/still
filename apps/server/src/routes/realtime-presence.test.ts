import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const touchListingPresenceMock = mock(async () => ({
	occupantCount: 1,
	changed: true,
}));
const leaveListingPresenceMock = mock(async () => ({
	occupantCount: 0,
	changed: true,
}));
const getListingPresenceSnapshotMock = mock(async () => ({
	viewerCount: 2,
	viewingPatrons: [
		{
			userId: "usr_friend",
			handle: "friend",
			displayName: "Friend",
			image: null,
			avatarIsAnimated: false,
			diaryMetalTier: null,
			presenceState: "active",
		},
	],
}));

const publishRealtimeEventMock = mock(async () => {});

mock.module("../lib/realtime-publish", () => ({
	publishRealtimeEvent: publishRealtimeEventMock,
}));

mock.module("../lib/rate-limit", () => ({
	hit: () => ({ ok: true }),
}));

mock.module("../lib/realtime-redis", () => ({
	getRealtimeRedis: () => ({}),
	isRealtimePublishEnabled: () => true,
}));

mock.module("../lib/listing-presence", () => ({
	isListingPresenceRoom: (roomId: string) =>
		/^listing:movie:\d+$/.test(roomId) || /^listing:tv:\d+$/.test(roomId),
	touchListingPresence: touchListingPresenceMock,
	leaveListingPresence: leaveListingPresenceMock,
	getListingPresenceSnapshot: getListingPresenceSnapshotMock,
}));

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				if (!id) return null;
				return {
					session: { id: `session-${id}` },
					user: { id, name: "Patron" },
				};
			},
		},
		handler: () => new Response("ok"),
	},
}));

const { realtimePresenceRoute } = await import("./realtime-presence");

const VALID_ROOM = "listing:movie:550";
const INVALID_ROOM = "review:rev_abc";

function makeApp() {
	return new Elysia().use(realtimePresenceRoute);
}

async function postPresence(input: {
	userId?: string;
	room: string;
}): Promise<Response> {
	return makeApp().handle(
		new Request("http://localhost/api/realtime/presence", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(input.userId ? { "x-user-id": input.userId } : {}),
			},
			body: JSON.stringify({ room: input.room }),
		}),
	);
}

async function deletePresence(input: {
	userId?: string;
	room: string;
}): Promise<Response> {
	return makeApp().handle(
		new Request("http://localhost/api/realtime/presence", {
			method: "DELETE",
			headers: {
				"content-type": "application/json",
				...(input.userId ? { "x-user-id": input.userId } : {}),
			},
			body: JSON.stringify({ room: input.room }),
		}),
	);
}

async function getPresence(input: {
	userId?: string;
	room: string;
}): Promise<Response> {
	const url = new URL("http://localhost/api/realtime/presence");
	url.searchParams.set("room", input.room);
	return makeApp().handle(
		new Request(url, {
			method: "GET",
			headers: {
				...(input.userId ? { "x-user-id": input.userId } : {}),
			},
		}),
	);
}

describe("POST /api/realtime/presence", () => {
	beforeEach(() => {
		touchListingPresenceMock.mockClear();
		publishRealtimeEventMock.mockClear();
		touchListingPresenceMock.mockResolvedValue({
			occupantCount: 1,
			changed: true,
		});
	});

	test("requires sign-in", async () => {
		const response = await postPresence({ room: VALID_ROOM });
		expect(response.status).toBe(401);
	});

	test("rejects non-listing rooms", async () => {
		const response = await postPresence({
			userId: "usr_a",
			room: INVALID_ROOM,
		});
		expect(response.status).toBe(403);
		expect(touchListingPresenceMock).not.toHaveBeenCalled();
	});

	test("touches presence and publishes when occupancy changes", async () => {
		const response = await postPresence({
			userId: "usr_a",
			room: VALID_ROOM,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(touchListingPresenceMock).toHaveBeenCalledTimes(1);
		expect(touchListingPresenceMock).toHaveBeenCalledWith(
			{},
			VALID_ROOM,
			"usr_a",
		);
		expect(publishRealtimeEventMock).toHaveBeenCalledTimes(1);
		expect(publishRealtimeEventMock).toHaveBeenCalledWith(VALID_ROOM, {
			type: "presence.updated",
		});
	});

	test("skips publish on heartbeat-only touch", async () => {
		touchListingPresenceMock.mockResolvedValueOnce({
			occupantCount: 2,
			changed: false,
		});

		const response = await postPresence({
			userId: "usr_a",
			room: VALID_ROOM,
		});

		expect(response.status).toBe(200);
		expect(publishRealtimeEventMock).not.toHaveBeenCalled();
	});
});

describe("DELETE /api/realtime/presence", () => {
	beforeEach(() => {
		leaveListingPresenceMock.mockClear();
		publishRealtimeEventMock.mockClear();
		leaveListingPresenceMock.mockResolvedValue({
			occupantCount: 0,
			changed: true,
		});
	});

	test("requires sign-in", async () => {
		const response = await deletePresence({ room: VALID_ROOM });
		expect(response.status).toBe(401);
	});

	test("rejects non-listing rooms", async () => {
		const response = await deletePresence({
			userId: "usr_a",
			room: INVALID_ROOM,
		});
		expect(response.status).toBe(403);
		expect(leaveListingPresenceMock).not.toHaveBeenCalled();
	});

	test("leaves room and publishes when occupancy changes", async () => {
		const response = await deletePresence({
			userId: "usr_a",
			room: VALID_ROOM,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(leaveListingPresenceMock).toHaveBeenCalledWith(
			{},
			VALID_ROOM,
			"usr_a",
		);
		expect(publishRealtimeEventMock).toHaveBeenCalledWith(VALID_ROOM, {
			type: "presence.updated",
		});
	});
});

describe("GET /api/realtime/presence", () => {
	beforeEach(() => {
		getListingPresenceSnapshotMock.mockClear();
	});

	test("requires sign-in", async () => {
		const response = await getPresence({ room: VALID_ROOM });
		expect(response.status).toBe(401);
	});

	test("rejects non-listing rooms", async () => {
		const response = await getPresence({
			userId: "usr_a",
			room: INVALID_ROOM,
		});
		expect(response.status).toBe(403);
		expect(getListingPresenceSnapshotMock).not.toHaveBeenCalled();
	});

	test("returns server-filtered snapshot", async () => {
		const response = await getPresence({
			userId: "usr_a",
			room: VALID_ROOM,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			viewerCount: 2,
			viewingPatrons: [
				{
					userId: "usr_friend",
					handle: "friend",
					displayName: "Friend",
					image: null,
					avatarIsAnimated: false,
					diaryMetalTier: null,
					presenceState: "active",
				},
			],
		});
		expect(getListingPresenceSnapshotMock).toHaveBeenCalledWith(
			"usr_a",
			VALID_ROOM,
			{},
		);
	});
});
