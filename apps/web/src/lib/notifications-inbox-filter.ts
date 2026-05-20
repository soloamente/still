/** Inbox slices for the sticky-header notifications menu. */
export type NotificationsInboxFilter = "unread" | "archive";

export const NOTIFICATIONS_INBOX_FILTER_LABEL: Record<
	NotificationsInboxFilter,
	string
> = {
	unread: "Unread",
	archive: "Archive",
};
