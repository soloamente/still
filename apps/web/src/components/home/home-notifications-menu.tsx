"use client";

import { Button } from "@still/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import IconBell from "@still/ui/icons/bell";
import IconBellFilled from "@still/ui/icons/bell-filled";
import { cn } from "@still/ui/lib/utils";
import { Award, Bell, MessageCircle, Trophy, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { accountMenuContentClassName } from "@/components/app/app-user-account-menu";
import { api } from "@/lib/api";
import { formatDistanceToNowStrict } from "@/lib/format";
import { postNotificationRead } from "@/lib/still-api-fetch";

/** One row from `GET /api/notifications` — same shape as `NotificationsList`. */
type NotificationRow = {
	id: string;
	kind: string;
	title: string;
	body: string | null;
	payload: Record<string, unknown>;
	readAt: string | null;
	createdAt: string;
};

/** Map dotted `kind` strings from the API to a small icon set (kept in sync with `NotificationsList`). */
function iconForKind(kind: string) {
	if (kind.startsWith("follow.")) return UserPlus;
	if (kind.startsWith("chat.")) return MessageCircle;
	if (kind.startsWith("badge.")) return Award;
	if (kind.startsWith("achievement.")) return Trophy;
	return Bell;
}

const PREVIEW_LIMIT = 6;

/**
 * Sticky-header notifications control: same dropdown shell as the avatar menu,
 * with a short preview list and a path to the full `/notifications` inbox.
 */
export function HomeNotificationsMenu({
	authenticated,
}: {
	authenticated: boolean;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [rows, setRows] = useState<NotificationRow[]>([]);
	const [loading, setLoading] = useState(false);
	const inFlight = useRef(new Set<string>());

	// Pull fresh rows whenever the sheet opens so the preview matches the server inbox.
	useEffect(() => {
		if (!open || !authenticated) return;

		let cancelled = false;
		void (async () => {
			setLoading(true);
			try {
				const res = await api.api.notifications.get();
				const data = (res.data as unknown as NotificationRow[]) ?? [];
				if (!cancelled) setRows(data);
			} catch {
				if (!cancelled) setRows([]);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [open, authenticated]);

	const preview = [...rows]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, PREVIEW_LIMIT);

	const hasUnread = rows.some((r) => !r.readAt);

	async function markOneRead(row: NotificationRow) {
		if (row.readAt || inFlight.current.has(row.id)) return;
		inFlight.current.add(row.id);
		const readAt = new Date().toISOString();
		const previousReadAt = row.readAt;
		setRows((prev) =>
			prev.map((r) => (r.id === row.id ? { ...r, readAt } : r)),
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
			// Best-effort; list stays unchanged on failure (same as full-page list).
		}
	}

	function handleRowActivate(row: NotificationRow) {
		const href =
			typeof row.payload.href === "string" ? row.payload.href : undefined;
		void markOneRead(row);
		if (href) router.push(href);
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Notifications"
						aria-expanded={open}
						className={cn(
							"size-11 shrink-0 rounded-full [@media(hover:hover)]:hover:bg-muted/35",
							// Match diary/watchlist: no filled “chip” until this control is active (menu open).
							open && "bg-card",
						)}
					>
						{/* Outline bell at rest; filled bell while the menu is open (Agentation / design feedback). */}
						<span className="relative z-10 text-foreground">
							{open ? <IconBellFilled aria-hidden /> : <IconBell aria-hidden />}
						</span>
					</Button>
				}
			/>
			<DropdownMenuContent
				align="end"
				className={cn(
					accountMenuContentClassName,
					"max-h-[min(70vh,28rem)] w-[min(100vw-2rem,20rem)] min-w-[280px] max-w-[360px]",
				)}
			>
				{!authenticated ? (
					<>
						<p className="py-2 text-base text-muted-foreground leading-snug">
							Sign in to see follows, replies, and other activity.
						</p>
						<DropdownMenuSeparator className="-mx-4 my-2" />
						<DropdownMenuGroup className="p-0">
							<DropdownMenuItem
								className="rounded-none px-0 py-3 text-base"
								onClick={() => router.push("/sign-in")}
							>
								Sign in
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</>
				) : loading && rows.length === 0 ? (
					<p className="py-8 text-center text-base text-muted-foreground">
						Loading…
					</p>
				) : (
					<>
						<div className="flex items-start justify-between gap-3 pt-2 pb-1">
							<div>
								<p className="font-semibold text-base text-foreground">
									Notifications
								</p>
								<p className="mt-0.5 text-muted-foreground text-sm">
									Recent activity
								</p>
							</div>
							{hasUnread ? (
								<Button
									type="button"
									variant="ghost-light"
									size="sm"
									className="shrink-0 rounded-full px-3 text-sm"
									onClick={() => void markAllRead()}
								>
									Mark all read
								</Button>
							) : null}
						</div>

						<DropdownMenuSeparator className="-mx-4 my-2" />

						{preview.length === 0 ? (
							<p className="py-6 text-center text-base text-muted-foreground leading-snug">
								Nothing new yet — reactions, follows, and notes will land here.
							</p>
						) : (
							<DropdownMenuGroup className="max-h-[min(52vh,22rem)] overflow-y-auto p-0">
								{preview.map((row) => {
									const Icon = iconForKind(row.kind);
									const unread = !row.readAt;
									return (
										<DropdownMenuItem
											key={row.id}
											className={cn(
												"flex cursor-pointer flex-col items-start gap-1 rounded-xl px-2 py-3 text-base",
												unread && "bg-card/60",
											)}
											onClick={() => handleRowActivate(row)}
										>
											<span className="flex w-full items-start gap-2">
												<Icon
													className="mt-0.5 size-4 shrink-0 text-desert-orange"
													aria-hidden
												/>
												<span className="min-w-0 flex-1">
													<span className="block font-medium leading-snug">
														{row.title}
													</span>
													{row.body ? (
														<span className="mt-0.5 line-clamp-2 text-muted-foreground leading-snug">
															{row.body}
														</span>
													) : null}
													<span className="mt-1 block text-muted-foreground text-xs">
														{formatDistanceToNowStrict(new Date(row.createdAt))}{" "}
														ago
													</span>
												</span>
											</span>
										</DropdownMenuItem>
									);
								})}
							</DropdownMenuGroup>
						)}

						<DropdownMenuSeparator className="-mx-4 my-2" />

						<DropdownMenuGroup className="p-0">
							<DropdownMenuItem
								className="rounded-none px-0 py-3 text-base"
								onClick={() => router.push("/notifications")}
							>
								View all notifications
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
