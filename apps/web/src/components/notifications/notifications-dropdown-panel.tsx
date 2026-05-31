"use client";

import { Skeleton } from "@still/ui/components/skeleton";
import IconBell from "@still/ui/icons/bell";
import { cn } from "@still/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
	Award,
	Bell,
	Download,
	Flame,
	Heart,
	MessageCircle,
	Trophy,
	Tv,
	UserPlus,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useRef } from "react";
import {
	ACHIEVEMENT_HEPTAGON_CLASS,
	HEPTAGON_CLIP,
} from "@/components/gamification/milestone-badge-glyph";
import { NotificationTasteChallengeRow } from "@/components/notifications/notification-taste-challenge-row";
import { NotificationsInboxFilterChips } from "@/components/notifications/notifications-inbox-filter-chips";
import { BADGE_ARTWORK_IMAGE_CLASS } from "@/lib/badge-artwork";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import { resolveNotificationBadgeIconUrl } from "@/lib/notification-badge-icon";
import type { NotificationsInboxFilter } from "@/lib/notifications-inbox-filter";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/** Inbox row — same fields as `GET /api/notifications`. */
export type NotificationPreviewRow = {
	id: string;
	kind: string;
	title: string;
	body: string | null;
	payload: Record<string, unknown>;
	readAt: string | null;
	createdAt: string;
};

function iconForKind(kind: string): LucideIcon {
	if (kind.startsWith("follow.")) return UserPlus;
	if (kind.startsWith("chat.")) return MessageCircle;
	if (kind.startsWith("comment.")) return MessageCircle;
	if (kind.startsWith("badge.")) return Award;
	if (kind.startsWith("achievement.")) return Trophy;
	if (kind === "tv.new_episode") return Tv;
	if (kind === "taste.challenge") return Trophy;
	if (kind === "challenge.completed") return Trophy;
	if (kind === "review.liked") return Heart;
	if (kind === "import.completed") return Download;
	return Bell;
}

const notificationRowClassName = cn(
	"flex w-full min-w-0 gap-3 rounded-[1.75rem] px-3 py-3.5 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
	"[@media(hover:hover)]:hover:bg-card/80",
);

const panelPillClassName = cn(
	"shrink-0 rounded-full bg-card px-3 py-1.5 font-medium text-foreground text-sm transition-colors duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

const BADGE_ARTWORK_FRAME_CLASS =
	"relative flex h-11 w-10 shrink-0 items-center justify-center overflow-visible";

function NotificationMenuScrims({
	showHeaderFade,
	showFooterFade,
}: {
	showHeaderFade: boolean;
	showFooterFade: boolean;
}) {
	return (
		<>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-linear-to-b from-25% from-popover via-popover/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showHeaderFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-linear-to-t from-15% from-popover/95 via-popover/25 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showFooterFade ? "opacity-100" : "opacity-0",
				)}
			/>
		</>
	);
}

function NotificationGlyph({ row }: { row: NotificationPreviewRow }) {
	const badgeArtUrl =
		row.kind === "badge.awarded"
			? resolveNotificationBadgeIconUrl(row.payload)
			: null;

	if (badgeArtUrl) {
		return (
			<span className={BADGE_ARTWORK_FRAME_CLASS}>
				<Image
					src={badgeArtUrl}
					alt=""
					width={40}
					height={48}
					unoptimized
					className={BADGE_ARTWORK_IMAGE_CLASS}
				/>
			</span>
		);
	}

	if (row.kind === "achievement.unlocked") {
		return (
			<span
				className={cn(
					"grid size-10 shrink-0 place-items-center overflow-visible",
					HEPTAGON_CLIP,
					ACHIEVEMENT_HEPTAGON_CLASS,
				)}
			>
				<Flame className="size-4 opacity-95" strokeWidth={1.5} aria-hidden />
			</span>
		);
	}

	const Icon = iconForKind(row.kind);
	return (
		<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-desert-orange">
			<Icon className="size-4 opacity-90" strokeWidth={1.5} aria-hidden />
		</span>
	);
}

function NotificationRowButton({
	row,
	onActivate,
}: {
	row: NotificationPreviewRow;
	onActivate: (row: NotificationPreviewRow) => void;
}) {
	const unread = !row.readAt;

	return (
		<button
			type="button"
			className={cn(notificationRowClassName, unread && "bg-card/70")}
			onClick={() => onActivate(row)}
		>
			<NotificationGlyph row={row} />
			<span className="min-w-0 flex-1">
				<span className="flex items-start gap-2">
					<span className="min-w-0 flex-1 font-medium text-base text-foreground leading-snug">
						{row.title}
					</span>
					{unread ? (
						<span
							className="mt-2 size-1.5 shrink-0 rounded-full bg-desert-orange"
							aria-hidden
						/>
					) : null}
				</span>
				{row.body ? (
					<span className="mt-0.5 line-clamp-2 block text-muted-foreground text-sm leading-snug">
						{row.body}
					</span>
				) : null}
				<span className="mt-1 block text-muted-foreground text-xs tabular-nums">
					{formatDistanceToNowStrict(new Date(row.createdAt))} ago
				</span>
			</span>
		</button>
	);
}

function NotificationPreviewSkeleton() {
	return (
		<div className="space-y-1 px-0.5" aria-hidden>
			{[0, 1, 2, 3].map((key) => (
				<div key={key} className="flex gap-3 rounded-[1.75rem] px-3 py-3.5">
					<Skeleton className="size-10 shrink-0 rounded-full bg-card" />
					<div className="min-w-0 flex-1 space-y-2 py-0.5">
						<Skeleton className="h-4 w-[78%] rounded-full bg-card" />
						<Skeleton className="h-3 w-[52%] rounded-full bg-card/80" />
					</div>
				</div>
			))}
		</div>
	);
}

function NotificationScrollList({
	rows,
	onRowActivate,
	onTasteChallengeAccept,
	onTasteChallengeDecline,
	loading,
	emptyTitle,
	emptyBody,
}: {
	rows: NotificationPreviewRow[];
	onRowActivate: (row: NotificationPreviewRow) => void;
	onTasteChallengeAccept?: (row: NotificationPreviewRow) => void;
	onTasteChallengeDecline?: (row: NotificationPreviewRow) => void;
	loading: boolean;
	emptyTitle: string;
	emptyBody: string;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentKey = rows.map((r) => r.id).join("|");
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		rows.length > 0,
		contentKey,
	);

	if (loading && rows.length === 0) {
		return <NotificationPreviewSkeleton />;
	}

	if (rows.length === 0) {
		return (
			<div className="py-8 text-center" role="status">
				<span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-card text-foreground">
					<IconBell aria-hidden />
				</span>
				<p className="mt-3 font-medium text-base text-foreground">
					{emptyTitle}
				</p>
				<p className="mx-auto mt-1 max-w-[16rem] text-balance text-muted-foreground text-sm leading-relaxed">
					{emptyBody}
				</p>
			</div>
		);
	}

	return (
		<div className="relative min-h-0 overflow-hidden rounded-[2.5rem]">
			<NotificationMenuScrims
				showHeaderFade={showHeaderFade}
				showFooterFade={showFooterFade}
			/>
			<div
				ref={scrollRef}
				className="scrollbar-thin max-h-[min(56vh,26rem)] min-h-0 overflow-y-auto overscroll-y-contain px-1 py-0.5 [-webkit-overflow-scrolling:touch]"
			>
				<div className="space-y-1.5 py-1.5">
					{rows.map((row) =>
						row.kind === "taste.challenge" &&
						onTasteChallengeAccept &&
						onTasteChallengeDecline ? (
							<NotificationTasteChallengeRow
								key={row.id}
								row={row}
								onAccept={onTasteChallengeAccept}
								onDecline={onTasteChallengeDecline}
							/>
						) : (
							<NotificationRowButton
								key={row.id}
								row={row}
								onActivate={onRowActivate}
							/>
						),
					)}
				</div>
			</div>
		</div>
	);
}

/**
 * Notifications dropdown — scrollable inbox on `bg-popover`, home-style filter chips.
 */
export function NotificationsDropdownPanel({
	authenticated,
	loading,
	rows,
	filter,
	onFilterChange,
	hasUnread,
	onMarkAllRead,
	onRowActivate,
	onTasteChallengeAccept,
	onTasteChallengeDecline,
	onSignIn,
}: {
	authenticated: boolean;
	loading: boolean;
	rows: NotificationPreviewRow[];
	filter: NotificationsInboxFilter;
	onFilterChange: (next: NotificationsInboxFilter) => void;
	hasUnread: boolean;
	onMarkAllRead: () => void;
	onRowActivate: (row: NotificationPreviewRow) => void;
	onTasteChallengeAccept?: (row: NotificationPreviewRow) => void;
	onTasteChallengeDecline?: (row: NotificationPreviewRow) => void;
	onSignIn: () => void;
}) {
	const sorted = useMemo(
		() =>
			[...rows].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		[rows],
	);

	const filtered = useMemo(() => {
		if (filter === "unread") return sorted.filter((r) => !r.readAt);
		return sorted.filter((r) => Boolean(r.readAt));
	}, [sorted, filter]);

	if (!authenticated) {
		return (
			<div className="space-y-3 pt-1">
				<div className="py-4 text-center">
					<span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-card text-foreground">
						<IconBell aria-hidden />
					</span>
					<p className="mt-3 font-medium text-base text-foreground">
						Sign in for activity
					</p>
					<p className="mx-auto mt-1 max-w-[16rem] text-balance text-muted-foreground text-sm leading-relaxed">
						Follows, replies, and badges appear here once you are in the booth.
					</p>
				</div>
				<button
					type="button"
					className={cn(panelPillClassName, "w-full")}
					onClick={onSignIn}
				>
					Sign in
				</button>
			</div>
		);
	}

	const emptyCopy =
		filter === "unread"
			? {
					title: "Inbox clear",
					body: "New follows, replies, and badges will show up here.",
				}
			: {
					title: "No archived notes",
					body: "Open a notification from Unread and it moves into this archive.",
				};

	return (
		<div className="flex min-h-0 flex-col gap-2">
			<NotificationsInboxFilterChips
				active={filter}
				onChange={onFilterChange}
			/>

			<NotificationScrollList
				rows={filtered}
				onRowActivate={onRowActivate}
				onTasteChallengeAccept={onTasteChallengeAccept}
				onTasteChallengeDecline={onTasteChallengeDecline}
				loading={loading}
				emptyTitle={emptyCopy.title}
				emptyBody={emptyCopy.body}
			/>

			{filter === "unread" && hasUnread ? (
				<div className="flex justify-end pt-0.5">
					<button
						type="button"
						className={panelPillClassName}
						onClick={onMarkAllRead}
					>
						Mark all read
					</button>
				</div>
			) : null}
		</div>
	);
}
