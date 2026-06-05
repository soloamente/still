"use client";

import { Button } from "@still/ui/components/button";
import {
	DropdownMenu,
	type DropdownMenuActions,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
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
/** Matches {@link HOME_STICKY_SHORTCUT_TOOLTIP_CLASS} in `home-sticky-chrome.tsx`. */
const HEADER_SHORTCUT_TOOLTIP_CLASS = "px-2 py-2 text-xs leading-none";

/** How often the bell refetches while the tab is foregrounded. */
const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000;

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
		const load = async () => {
			try {
				const data = await fetchNotifications();
				if (!cancelled) setRows(data);
			} catch {
				// Keep the last good inbox on a transient failure.
			}
		};

		void load();

		// Near-realtime inbox: poll while the tab is visible. We can't hold a
		// socket open on serverless, so a light interval keeps the bell current
		// without waiting for the user to reopen the menu. Refetch immediately
		// on tab refocus so a backgrounded tab catches up at once.
		let timer: ReturnType<typeof setInterval> | null = null;
		const start = () => {
			if (timer != null) return;
			timer = setInterval(() => {
				if (document.visibilityState === "visible") void load();
			}, NOTIFICATIONS_POLL_INTERVAL_MS);
		};
		const stop = () => {
			if (timer == null) return;
			clearInterval(timer);
			timer = null;
		};
		const onVisibility = () => {
			if (document.visibilityState === "visible") {
				void load();
				start();
			} else {
				stop();
			}
		};
		start();
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			cancelled = true;
			stop();
			document.removeEventListener("visibilitychange", onVisibility);
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
			{/* Same instant tooltip shell as watchlist / lists / diary in `HomeStickyChrome`. */}
			<Tooltip>
				<TooltipTrigger
					render={
						<DropdownMenuTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={
										hasUnread ? "Notifications, unread" : "Notifications"
									}
									aria-expanded={menuOpen}
									className={cn(
										"group size-11 shrink-0 rounded-full [@media(hover:hover)]:hover:bg-muted/35",
										/* Base UI keeps `data-popup-open` through the exit animation — not React `open`. */
										"data-popup-open:bg-card",
									)}
								>
									<span className="relative z-10 text-foreground">
										{hasUnread ? (
											<IconBellFilled
												aria-hidden
												className={HEADER_ICON_CLASS}
											/>
										) : (
											<IconBell aria-hidden className={HEADER_ICON_CLASS} />
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
					}
				/>
				<TooltipContent
					sideOffset={2}
					className={HEADER_SHORTCUT_TOOLTIP_CLASS}
				>
					Notifications
				</TooltipContent>
			</Tooltip>
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
