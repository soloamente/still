"use client";

import { userInboxRoomId } from "@still/realtime";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { emitNotificationsInboxLive } from "@/lib/notifications-inbox-live";

/**
 * Listens on the patron inbox SSE room and triggers inbox refetch hooks.
 * Render once inside `RealtimeRootProvider` (app layout).
 */
export function InboxRealtimeSubscriber({ userId }: { userId: string }) {
	useRealtimeSubscription({
		room: userInboxRoomId(userId),
		onEvent: (event) => {
			if (event.type !== "notification.created") return;
			emitNotificationsInboxLive();
		},
	});

	return null;
}
