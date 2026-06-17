"use client";

import { NotificationsBellMenu } from "@/components/notifications/notifications-bell-menu";

/**
 * Sticky-header notifications — scrollable inbox on elevated `bg-popover` surface.
 * Inbox fetch/state lives in `NotificationsInboxProvider` (app layout).
 */
export function HomeNotificationsMenu({
	authenticated,
}: {
	authenticated: boolean;
}) {
	return (
		<NotificationsBellMenu authenticated={authenticated} variant="lobby" />
	);
}
