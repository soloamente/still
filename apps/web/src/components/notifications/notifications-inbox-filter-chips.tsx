"use client";

import { cn } from "@still/ui/lib/utils";

import {
	NOTIFICATIONS_INBOX_FILTER_LABEL,
	type NotificationsInboxFilter,
} from "@/lib/notifications-inbox-filter";

/**
 * Unread / Archive — same pill rail as `HomeCatalogSortChips` on `bg-background`.
 * No shared `layoutId` here: the menu portal unmounts on close and Motion layout
 * animation caused visible flicker when toggling the bell quickly.
 */
export function NotificationsInboxFilterChips({
	active,
	onChange,
}: {
	active: NotificationsInboxFilter;
	onChange: (next: NotificationsInboxFilter) => void;
}) {
	const chipButton = (isActive: boolean) =>
		cn(
			"relative inline-flex min-h-10 flex-1 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			"px-4 py-3.5",
			isActive
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const tabs: NotificationsInboxFilter[] = ["unread", "archive"];

	return (
		<div
			className="flex w-full gap-1.5 rounded-full bg-background p-1"
			role="toolbar"
			aria-label="Notification inbox"
		>
			{tabs.map((tab) => {
				const isActive = tab === active;
				return (
					<button
						key={tab}
						type="button"
						aria-pressed={isActive}
						className={chipButton(isActive)}
						onClick={() => onChange(tab)}
					>
						{isActive ? (
							<span
								className="absolute inset-0 z-0 rounded-full bg-card"
								aria-hidden
							/>
						) : null}
						<span className="relative z-10 whitespace-nowrap">
							{NOTIFICATIONS_INBOX_FILTER_LABEL[tab]}
						</span>
					</button>
				);
			})}
		</div>
	);
}
