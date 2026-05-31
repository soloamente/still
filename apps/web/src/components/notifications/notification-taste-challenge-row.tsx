"use client";

import { cn } from "@still/ui/lib/utils";
import { Trophy } from "lucide-react";
import {
	DetailMotionButton,
	DetailMotionLink,
} from "@/components/movie/detail-motion-pressable";
import type { NotificationPreviewRow } from "@/components/notifications/notifications-dropdown-panel";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import { notificationPayloadHref } from "@/lib/notification-href";

/** Shared shell with default inbox rows — flat surface on popover, no row borders. */
export const notificationInboxRowShellClassName = cn(
	"flex w-full min-w-0 gap-3 rounded-[1.75rem] px-3 py-3.5 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
);

/** Compact inbox pills — aligned with `panelPillClassName` in the notifications dropdown. */
const tasteChallengeActionBaseClassName = cn(
	"inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1.5 font-medium text-foreground text-xs transition-colors duration-200 ease-out motion-reduce:transition-none",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
	"disabled:pointer-events-none disabled:opacity-45",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

const tasteChallengeSecondaryActionClassName = cn(
	tasteChallengeActionBaseClassName,
	"bg-card",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

const tasteChallengePrimaryActionClassName = cn(
	tasteChallengeActionBaseClassName,
	"bg-foreground text-background",
);

const tasteChallengeArchiveLinkClassName = cn(
	tasteChallengeSecondaryActionClassName,
);

/**
 * Taste challenge inbox row — explicit Compare / Not now actions (not a mystery tap target).
 */
export function NotificationTasteChallengeRow({
	row,
	onAccept,
	onDecline,
}: {
	row: NotificationPreviewRow;
	onAccept: (row: NotificationPreviewRow) => void;
	onDecline: (row: NotificationPreviewRow) => void;
}) {
	const unread = !row.readAt;
	const href = notificationPayloadHref(row.payload);
	const titleId = `notification-title-${row.id}`;

	return (
		<article
			className={cn(notificationInboxRowShellClassName, unread && "bg-card/70")}
			aria-labelledby={titleId}
		>
			<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-desert-orange">
				<Trophy className="size-4 opacity-90" strokeWidth={1.5} aria-hidden />
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="min-w-0">
					<div className="flex items-start gap-2">
						<p
							id={titleId}
							className="min-w-0 flex-1 font-medium text-base text-foreground leading-snug"
						>
							{row.title}
						</p>
						{unread ? (
							<span
								className="mt-2 size-1.5 shrink-0 rounded-full bg-desert-orange"
								aria-hidden
							/>
						) : null}
					</div>
					{row.body ? (
						<p className="mt-0.5 text-balance text-muted-foreground text-sm leading-snug">
							{row.body}
						</p>
					) : null}
					<p className="mt-1 text-muted-foreground text-xs tabular-nums">
						{formatDistanceToNowStrict(new Date(row.createdAt))} ago
					</p>
				</div>

				{unread ? (
					<fieldset className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0">
						<legend className="sr-only">Taste challenge response</legend>
						<DetailMotionButton
							type="button"
							className={tasteChallengePrimaryActionClassName}
							onClick={() => onAccept(row)}
						>
							Compare tastes
						</DetailMotionButton>
						<DetailMotionButton
							type="button"
							className={tasteChallengeSecondaryActionClassName}
							onClick={() => onDecline(row)}
						>
							Not now
						</DetailMotionButton>
					</fieldset>
				) : href ? (
					<DetailMotionLink
						href={href}
						className={tasteChallengeArchiveLinkClassName}
						onClick={() => onAccept(row)}
					>
						View comparison
					</DetailMotionLink>
				) : null}
			</div>
		</article>
	);
}
