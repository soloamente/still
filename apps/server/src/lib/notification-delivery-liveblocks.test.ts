import { beforeEach, describe, expect, mock, test } from "bun:test";

const publishRealtimeEventMock = mock(async () => {});

mock.module("./realtime-publish", () => ({
	publishRealtimeEvent: publishRealtimeEventMock,
}));

const notificationTable = { __table: "notification" };
const profileTable = { __table: "profile" };

let insertedNotificationId: string | null = null;

mock.module("@still/db", () => ({
	db: {
		insert(table: { __table?: string }) {
			return {
				values(values: Record<string, unknown>) {
					if (table === notificationTable) {
						insertedNotificationId = String(values.id);
					}
					return Promise.resolve();
				},
			};
		},
	},
	notification: notificationTable,
	profile: profileTable,
	follow: {},
	user: { __table: "user" },
	comment: { __table: "comment" },
	review: { __table: "review" },
	eventLog: { __table: "eventLog" },
	reaction: { __table: "reaction" },
}));

mock.module("./cuid", () => ({
	makeId: (prefix: string) => `${prefix}_liveblocks_test`,
}));

const { deliverNotification, readNotificationPrefs } = await import(
	"./notification-delivery"
);

describe("deliverNotification liveblocks fan-out", () => {
	beforeEach(() => {
		publishRealtimeEventMock.mockClear();
		insertedNotificationId = null;
	});

	test("broadcasts notification.created to the patron inbox room", async () => {
		await deliverNotification({
			userId: "usr_recipient",
			kind: "follow.created",
			title: "Someone followed you",
			payload: { fromUserId: "usr_actor" },
			prefs: readNotificationPrefs(null),
			context: { actorUserId: "usr_actor" },
		});

		expect(insertedNotificationId).toBe("ntf_liveblocks_test");
		expect(publishRealtimeEventMock).toHaveBeenCalledTimes(1);
		expect(publishRealtimeEventMock).toHaveBeenCalledWith(
			"user:usr_recipient:inbox",
			{
				type: "notification.created",
				notificationId: "ntf_liveblocks_test",
				kind: "follow.created",
			},
		);
	});

	test("skips broadcast when prefs block delivery", async () => {
		await deliverNotification({
			userId: "usr_recipient",
			kind: "follow.created",
			title: "Someone followed you",
			prefs: {
				...readNotificationPrefs(null),
				"follow.created": false,
			},
			context: { actorUserId: "usr_actor" },
		});

		expect(publishRealtimeEventMock).not.toHaveBeenCalled();
	});
});
