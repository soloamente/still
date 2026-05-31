"use client";

import { Button } from "@still/ui/components/button";
import {
	DropdownMenu,
	type DropdownMenuActions,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import IconBell from "@still/ui/icons/bell";
import IconBellFilled from "@still/ui/icons/bell-filled";
import { cn } from "@still/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { accountMenuContentClassName } from "@/components/app/app-user-account-menu";
import {
	type NotificationPreviewRow,
	NotificationsDropdownPanel,
} from "@/components/notifications/notifications-dropdown-panel";
import { api } from "@/lib/api";
import { notificationPayloadHref } from "@/lib/notification-href";
import type { NotificationsInboxFilter } from "@/lib/notifications-inbox-filter";
import { postNotificationRead } from "@/lib/still-api-fetch";

const INBOX_FETCH_LIMIT = 80;

/** Matches {@link HOME_STICKY_HEADER_ICON_CLASS} in `home-sticky-chrome.tsx`. */
const HEADER_ICON_CLASS = "size-5 shrink-0";

/**
 * Sticky-header notifications — scrollable inbox on elevated `bg-popover` surface.
 */
export function HomeNotificationsMenu({
	authenticated,
}: {
	authenticated: boolean;
}) {
	const router = useRouter();
	/** Mirrored for aria only — menu open state stays uncontrolled so exit animation can finish. */
	const [menuOpen, setMenuOpen] = useState(false);
	const menuActionsRef = useRef<DropdownMenuActions | null>(null);
	const [filter, setFilter] = useState<NotificationsInboxFilter>("unread");
	const [rows, setRows] = useState<NotificationPreviewRow[]>([]);
	const [loading, setLoading] = useState(false);
	const inFlight = useRef(new Set<string>());
	const rowsRef = useRef(rows);
	rowsRef.current = rows;

	const fetchNotifications = useCallback(async () => {
		const res = await api.api.notifications.get({
			query: { limit: String(INBOX_FETCH_LIMIT) },
		});
		return (res.data as unknown as NotificationPreviewRow[]) ?? [];
	}, []);

	useEffect(() => {
		if (!authenticated) {
			setRows([]);
			return;
		}

		let cancelled = false;
		void (async () => {
			try {
				const data = await fetchNotifications();
				if (!cancelled) setRows(data);
			} catch {
				if (!cancelled) setRows([]);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [authenticated, fetchNotifications]);

	const refreshInbox = useCallback(async () => {
		if (rowsRef.current.length === 0) setLoading(true);
		try {
			const data = await fetchNotifications();
			setRows(data);
		} catch {
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, [fetchNotifications]);

	function handleMenuOpenChange(next: boolean) {
		setMenuOpen(next);
		if (next && authenticated) {
			void refreshInbox();
		}
	}

	const hasUnread = rows.some((r) => !r.readAt);

	async function markOneRead(row: NotificationPreviewRow) {
		if (row.readAt || inFlight.current.has(row.id)) return;
		inFlight.current.add(row.id);
		const previousReadAt = row.readAt;
		setRows((prev) =>
			prev.map((r) =>
				r.id === row.id ? { ...r, readAt: new Date().toISOString() } : r,
			),
		);
		const res = await postNotificationRead(row.id);
		if (!res.ok) {
			setRows((prev) =>
				prev.map((r) =>
					r.id === row.id ? { ...r, readAt: previousReadAt } : r,
				),
			);
		}
		inFlight.current.delete(row.id);
	}

	async function markAllRead() {
		try {
			await api.api.notifications["read-all"].post();
			setRows((prev) =>
				prev.map((r) => ({
					...r,
					readAt: r.readAt ?? new Date().toISOString(),
				})),
			);
		} catch {
			// Best-effort.
		}
	}

	function handleRowActivate(row: NotificationPreviewRow) {
		if (row.kind === "taste.challenge") return;
		void markOneRead(row);
		const href = notificationPayloadHref(row.payload);
		if (href) {
			menuActionsRef.current?.close();
			router.push(href);
		}
	}

	function handleTasteChallengeAccept(row: NotificationPreviewRow) {
		void markOneRead(row);
		const href = notificationPayloadHref(row.payload);
		menuActionsRef.current?.close();
		if (href) router.push(href);
	}

	function handleTasteChallengeDecline(row: NotificationPreviewRow) {
		void markOneRead(row);
		menuActionsRef.current?.close();
		toast.message("Challenge dismissed");
	}

	return (
		<DropdownMenu
			actionsRef={menuActionsRef}
			onOpenChange={handleMenuOpenChange}
		>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={hasUnread ? "Notifications, unread" : "Notifications"}
						aria-expanded={menuOpen}
						className={cn(
							"group size-11 shrink-0 rounded-full [@media(hover:hover)]:hover:bg-muted/35",
							/* Base UI keeps `data-popup-open` through the exit animation — not React `open`. */
							"data-popup-open:bg-card",
						)}
					>
						<span className="relative z-10 text-foreground">
							{hasUnread ? (
								<IconBellFilled aria-hidden className={HEADER_ICON_CLASS} />
							) : (
								<>
									<IconBell
										aria-hidden
										className={cn(
											HEADER_ICON_CLASS,
											"group-data-popup-open:hidden",
										)}
									/>
									<IconBellFilled
										aria-hidden
										className={cn(
											HEADER_ICON_CLASS,
											"hidden group-data-popup-open:block",
										)}
									/>
								</>
							)}
							{hasUnread ? (
								<span
									className="absolute top-0 right-0 size-2 rounded-full bg-desert-orange ring-2 ring-background"
									aria-hidden
								/>
							) : null}
						</span>
					</Button>
				}
			/>
			<DropdownMenuContent
				align="end"
				sideOffset={8}
				className={cn(
					accountMenuContentClassName,
					"max-h-[min(72vh,34rem)] w-[min(100vw-2rem,22rem)]! min-w-[300px] max-w-[380px] rounded-[2.5rem]! pt-4 pb-0",
				)}
			>
				<NotificationsDropdownPanel
					authenticated={authenticated}
					loading={loading}
					rows={rows}
					filter={filter}
					onFilterChange={setFilter}
					hasUnread={hasUnread}
					onMarkAllRead={() => void markAllRead()}
					onRowActivate={handleRowActivate}
					onTasteChallengeAccept={handleTasteChallengeAccept}
					onTasteChallengeDecline={handleTasteChallengeDecline}
					onSignIn={() => {
						menuActionsRef.current?.close();
						router.push("/sign-in");
					}}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
