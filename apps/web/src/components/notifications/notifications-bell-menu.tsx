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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { accountMenuContentClassName } from "@/components/app/app-user-account-menu";
import {
	type NotificationPreviewRow,
	NotificationsDropdownPanel,
} from "@/components/notifications/notifications-dropdown-panel";
import { useNotificationsInbox } from "@/components/notifications/notifications-inbox-provider";
import { notificationPayloadHref } from "@/lib/notification-href";
import type { NotificationsInboxFilter } from "@/lib/notifications-inbox-filter";

/** Matches {@link HOME_STICKY_HEADER_ICON_CLASS} in `home-sticky-chrome.tsx`. */
const LOBBY_ICON_CLASS = "size-5 shrink-0";

/** Shared notifications dropdown — lobby bell, detail top bars, and compact triggers. */
export function NotificationsBellMenu({
	authenticated,
	variant = "lobby",
	tooltip = "Notifications",
	showTooltip = true,
}: {
	authenticated: boolean;
	variant?: "lobby" | "compact";
	tooltip?: string;
	showTooltip?: boolean;
}) {
	const router = useRouter();
	const { rows, unreadCount, loading, refresh, markOneRead, markAllRead } =
		useNotificationsInbox();
	// Inbox unread hydrates client-side — gate chrome so SSR matches first paint.
	const [unreadChromeReady, setUnreadChromeReady] = useState(false);
	useEffect(() => {
		setUnreadChromeReady(true);
	}, []);
	const hasUnread = unreadChromeReady && unreadCount > 0;
	const [menuOpen, setMenuOpen] = useState(false);
	const [filter, setFilter] = useState<NotificationsInboxFilter>("unread");
	const menuActionsRef = useRef<DropdownMenuActions | null>(null);

	function handleMenuOpenChange(next: boolean) {
		setMenuOpen(next);
		if (next && authenticated) {
			void refresh();
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

	// Base UI `render` must receive a direct <Button /> template — not a wrapper component.
	const bellTrigger = (
		<DropdownMenuTrigger
			render={
				variant === "lobby" ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={hasUnread ? "Notifications, unread" : "Notifications"}
						aria-expanded={menuOpen}
						className={cn(
							"group size-11 shrink-0 rounded-full [@media(hover:hover)]:hover:bg-muted/35",
							"data-popup-open:bg-card",
						)}
					>
						<span className="relative z-10 text-foreground">
							{hasUnread ? (
								<IconBellFilled aria-hidden className={LOBBY_ICON_CLASS} />
							) : (
								<IconBell aria-hidden className={LOBBY_ICON_CLASS} />
							)}
							{hasUnread ? (
								<span
									className="absolute top-0 right-0 size-2 rounded-full bg-desert-orange ring-2 ring-background"
									aria-hidden
								/>
							) : null}
						</span>
					</Button>
				) : (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={hasUnread ? "Notifications, unread" : "Notifications"}
						aria-expanded={menuOpen}
						className={cn(
							"relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-foreground [@media(hover:hover)]:hover:bg-muted/35",
							"data-popup-open:bg-muted/35",
						)}
					>
						{hasUnread ? (
							<IconBellFilled aria-hidden className="size-5 shrink-0" />
						) : (
							<IconBell aria-hidden className="size-5 shrink-0" />
						)}
						{hasUnread ? (
							<span
								className="absolute top-1 right-1 size-2 rounded-full bg-desert-orange ring-2 ring-card"
								aria-hidden
							/>
						) : null}
					</Button>
				)
			}
		/>
	);

	const menuTrigger = showTooltip ? (
		<Tooltip>
			<TooltipTrigger render={bellTrigger} />
			<TooltipContent sideOffset={2} className="px-2 py-2 text-xs leading-none">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	) : (
		bellTrigger
	);

	return (
		<DropdownMenu
			actionsRef={menuActionsRef}
			onOpenChange={handleMenuOpenChange}
		>
			{menuTrigger}
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
