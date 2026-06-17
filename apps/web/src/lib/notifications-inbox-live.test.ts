import { describe, expect, test } from "bun:test";

import {
	emitNotificationsInboxLive,
	subscribeNotificationsInboxLive,
} from "@/lib/notifications-inbox-live";

describe("notifications-inbox-live", () => {
	test("emit notifies all subscribers", () => {
		let count = 0;
		const unsub = subscribeNotificationsInboxLive(() => {
			count += 1;
		});

		emitNotificationsInboxLive();
		expect(count).toBe(1);

		unsub();
		emitNotificationsInboxLive();
		expect(count).toBe(1);
	});
});
