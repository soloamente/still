"use client";

import { useEffect } from "react";
import { useNotificationsInbox } from "@/components/notifications/notifications-inbox-provider";
import { NotificationsList } from "@/components/notifications/notifications-list";

type NotificationRow = {
	id: string;
	kind: string;
	title: string;
	body: string | null;
	payload: Record<string, unknown>;
	readAt: string | null;
	createdAt: string;
};

/** `/notifications` list — hydrates from RSC then follows the global inbox provider. */
export function NotificationsListLive({
	initialItems,
}: {
	initialItems: NotificationRow[];
}) {
	const { rows, refresh } = useNotificationsInbox();

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const items = rows.length > 0 ? rows : initialItems;

	return <NotificationsList items={items} />;
}
