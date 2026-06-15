"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import {
	Award,
	Bell,
	Download,
	Heart,
	MessageCircle,
	Play,
	ShieldCheck,
	Trophy,
	Tv,
	UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { NotificationTasteChallengeRow } from "@/components/notifications/notification-taste-challenge-row";
import type { NotificationPreviewRow } from "@/components/notifications/notifications-dropdown-panel";
import { api } from "@/lib/api";
import { formatDistanceToNowStrict } from "@/lib/format";
import { notificationPayloadHref } from "@/lib/notification-href";
import { postNotificationRead } from "@/lib/still-api-fetch";

/** One row from `GET /api/notifications` (after server enrichment of `payload.href`). */
type Row = {
	id: string;
	kind: string;
	title: string;
	body: string | null;
	payload: Record<string, unknown>;
	readAt: string | null;
	createdAt: string;
};

/** YYYY-MM-DD in the viewer's local calendar (used for grouping headings). */
function localDayKey(d: Date): string {
	const y = d.getFullYear();
	const m = d.getMonth() + 1;
	const day = d.getDate();
	return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDayKeyFromIso(iso: string): string {
	return localDayKey(new Date(iso));
}

function formatGroupHeading(dayKeyStr: string): string {
	const today = localDayKey(new Date());
	const yd = new Date();
	yd.setDate(yd.getDate() - 1);
	const yesterday = localDayKey(yd);
	if (dayKeyStr === today) return "Today";
	if (dayKeyStr === yesterday) return "Yesterday";
	const [y, mo, d] = dayKeyStr.split("-").map(Number);
	const dt = new Date(y, mo - 1, d);
	const nowY = new Date().getFullYear();
	return dt.toLocaleDateString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
		...(nowY !== y ? { year: "numeric" as const } : {}),
	});
}

/** Map dotted `kind` strings from the API to a small icon set. */
function iconForKind(kind: string) {
	if (kind === "staff.role_changed") return ShieldCheck;
	if (kind.startsWith("follow.")) return UserPlus;
	if (kind.startsWith("chat.")) return MessageCircle;
	if (kind.startsWith("comment.")) return MessageCircle;
	if (kind.startsWith("badge.")) return Award;
	if (kind.startsWith("achievement.")) return Trophy;
	if (kind === "tv.new_episode") return Tv;
	if (kind === "watchlist_now_streaming") return Play;
	if (kind === "taste.challenge") return Trophy;
	if (kind === "review.liked") return Heart;
	if (kind === "import.completed") return Download;
	return Bell;
}

export function NotificationsList({ items }: { items: Row[] }) {
	const router = useRouter();
	const [rows, setRows] = useState(items);
	/** Prevents duplicate POST /read while a row is in flight (e.g. rapid clicks). */
	const inFlight = useRef(new Set<string>());

	const sections = useMemo(() => {
		const map = new Map<string, Row[]>();
		const order: string[] = [];
		for (const row of rows) {
			const key = localDayKeyFromIso(row.createdAt);
			let bucket = map.get(key);
			if (!bucket) {
				bucket = [];
				map.set(key, bucket);
				order.push(key);
			}
			bucket.push(row);
		}
		return order.map((key) => {
			const items = map.get(key) ?? [];
			return {
				key,
				label: formatGroupHeading(key),
				items,
			};
		});
	}, [rows]);

	async function markOneRead(row: Row) {
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

	async function activateRow(row: Row) {
		if (row.kind === "taste.challenge") return;
		await markOneRead(row);
		const href = notificationPayloadHref(row.payload);
		if (href) router.push(href);
	}

	function handleTasteChallengeAccept(row: Row) {
		void markOneRead(row);
		const href = notificationPayloadHref(row.payload);
		if (href) router.push(href);
	}

	function handleTasteChallengeDecline(row: Row) {
		void markOneRead(row);
		toast.message("Challenge dismissed");
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
			// Best-effort; list stays unchanged on failure.
		}
	}

	if (rows.length === 0) {
		return (
			<p className="rounded-2xl border border-border border-dashed bg-card/40 p-10 text-center text-muted-foreground text-sm">
				The projection booth is quiet — no new stubs yet. We&apos;ll light the
				marquee when someone reacts, follows, or slips a note under your door.
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-end">
				<Button
					variant="ghost-light"
					size="sm"
					type="button"
					onClick={() => void markAllRead()}
				>
					Mark all read
				</Button>
			</div>
			{sections.map((section) => (
				<section key={section.key} className="space-y-2">
					<h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						{section.label}
					</h2>
					<ul className="space-y-2">
						{section.items.map((row) => {
							if (row.kind === "taste.challenge") {
								return (
									<li
										key={row.id}
										className={cn(
											"rounded-[1.75rem]",
											row.readAt ? "bg-card/40" : "bg-card/70",
										)}
									>
										<NotificationTasteChallengeRow
											row={row as NotificationPreviewRow}
											onAccept={(r) => handleTasteChallengeAccept(r as Row)}
											onDecline={(r) => handleTasteChallengeDecline(r as Row)}
										/>
									</li>
								);
							}

							const Icon = iconForKind(row.kind);
							const href = notificationPayloadHref(row.payload);
							return (
								<li
									key={row.id}
									className={cn(
										"flex min-h-11 gap-3 rounded-md border p-3 text-sm sm:items-start",
										row.readAt
											? "border-border bg-card/40"
											: "border-desert-orange/30 bg-desert-orange/5",
									)}
								>
									<Icon
										className="mt-0.5 size-4 shrink-0 text-desert-orange"
										aria-hidden
									/>
									<div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
										<button
											type="button"
											className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/40"
											onClick={() => void activateRow(row)}
										>
											<p className="font-medium leading-snug">{row.title}</p>
											{row.body ? (
												<p className="mt-0.5 text-muted-foreground leading-snug">
													{row.body}
												</p>
											) : null}
											<p className="mt-1 text-muted-foreground text-xs">
												{formatDistanceToNowStrict(new Date(row.createdAt))} ago
											</p>
										</button>
										{href ? (
											<Link
												href={href}
												className="shrink-0 text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
												onClick={() => void markOneRead(row)}
											>
												Open
											</Link>
										) : null}
									</div>
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}
