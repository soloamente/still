"use client";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	NOTIFICATIONS_INBOX_FILTER_LABEL,
	type NotificationsInboxFilter,
} from "@/lib/notifications-inbox-filter";

/** Unread / Archive — liquid-gooey Move pill (home chip parity). */
export function NotificationsInboxFilterChips({
	active,
	onChange,
}: {
	active: NotificationsInboxFilter;
	onChange: (next: NotificationsInboxFilter) => void;
}) {
	const tabs: NotificationsInboxFilter[] = ["unread", "archive"];

	return (
		<SegmentedPillToolbar
			layoutId="notifications-inbox-filter-pill"
			aria-label="Notification inbox"
			value={active}
			onChange={onChange}
			options={tabs.map((tab) => ({
				id: tab,
				label: NOTIFICATIONS_INBOX_FILTER_LABEL[tab],
			}))}
			optionClassName="min-h-10 flex-1 px-4 py-3.5"
			className="w-full gap-1.5"
		/>
	);
}
