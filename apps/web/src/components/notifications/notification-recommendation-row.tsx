"use client";

import { cn } from "@still/ui/lib/utils";
import { Check, Gift } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { notificationInboxRowShellClassName } from "@/components/notifications/notification-taste-challenge-row";
import type { NotificationPreviewRow } from "@/components/notifications/notifications-dropdown-panel";
import { openRecommendBackSheet } from "@/components/recommend/recommend-back-sheet-root";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import { postRecommendationAction } from "@/lib/still-api-fetch";
import { parseRecommendationNotificationPayload } from "@/lib/title-recommendation";
import { isTmdbCdnUrl, tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

/** Same compact pills as the taste-challenge row — aligned with the dropdown's panel pills. */
const actionBaseClassName = cn(
	"inline-flex shrink-0 select-none items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-foreground text-xs transition-colors duration-200 ease-out motion-reduce:transition-none",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
	"disabled:pointer-events-none disabled:opacity-45",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

const primaryActionClassName = cn(
	actionBaseClassName,
	"bg-foreground text-background",
);

const secondaryActionClassName = cn(
	actionBaseClassName,
	"bg-card",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

type AcceptState = "idle" | "saving" | "done" | "error";

/**
 * `recommendation.received` inbox row — tap opens the title; explicit
 * **Add to watchlist** / **Recommend something back** actions below.
 * Sensitive sends arrive pre-scrubbed (no poster / title in the payload).
 */
export function NotificationRecommendationRow({
	row,
	onOpen,
	onMarkRead,
	onBeforeSheetOpen,
}: {
	row: NotificationPreviewRow;
	/** Mark read + navigate to the title (host owns routing / menu close). */
	onOpen: (row: NotificationPreviewRow) => void;
	onMarkRead: (row: NotificationPreviewRow) => void;
	/** Dropdown hosts close their menu before the sheet takes focus. */
	onBeforeSheetOpen?: () => void;
}) {
	const target = parseRecommendationNotificationPayload(row.payload);
	const [acceptState, setAcceptState] = useState<AcceptState>("idle");
	const [sentBack, setSentBack] = useState(false);
	const unread = !row.readAt;
	const titleId = `notification-title-${row.id}`;
	const posterPath =
		typeof row.payload.posterPath === "string" ? row.payload.posterPath : null;
	const posterUrl = tmdbPosterUrlFromPath(posterPath, "w92");

	async function handleAccept() {
		if (!target || acceptState === "saving" || acceptState === "done") return;
		setAcceptState("saving");
		onMarkRead(row);
		const res = await postRecommendationAction(
			target.recommendationId,
			"accept",
		);
		setAcceptState(res.ok ? "done" : "error");
	}

	function handleRecommendBack() {
		if (!target) return;
		onMarkRead(row);
		onBeforeSheetOpen?.();
		openRecommendBackSheet(
			{
				recipientUserId: target.fromUserId,
				recipientName: target.fromName,
				answerToRecommendationId: target.recommendationId,
			},
			() => {
				setSentBack(true);
				// Dropdown rows unmount when the menu closes — confirm where the patron is.
				if (onBeforeSheetOpen) toast.success("Recommendation sent");
			},
		);
	}

	function handleOpen() {
		if (target) {
			// Funnel timestamp only — navigation never waits on it.
			void postRecommendationAction(target.recommendationId, "open");
		}
		onOpen(row);
	}

	return (
		<article
			className={cn(notificationInboxRowShellClassName, unread && "bg-card/70")}
			aria-labelledby={titleId}
		>
			<span className="relative inline-flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card text-desert-orange">
				{posterUrl ? (
					<Image
						src={posterUrl}
						alt=""
						fill
						sizes="40px"
						className="object-cover"
						unoptimized={isTmdbCdnUrl(posterUrl)}
					/>
				) : (
					<Gift className="size-4 opacity-90" strokeWidth={1.5} aria-hidden />
				)}
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<button
					type="button"
					className="min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={handleOpen}
				>
					<span className="flex items-start gap-2">
						<span
							id={titleId}
							className="min-w-0 flex-1 font-medium text-base text-foreground leading-snug"
						>
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
						<span className="mt-0.5 line-clamp-2 block text-pretty text-muted-foreground text-sm leading-snug">
							{row.body}
						</span>
					) : null}
					<span className="mt-1 block text-muted-foreground text-xs tabular-nums">
						{formatDistanceToNowStrict(new Date(row.createdAt))} ago
					</span>
				</button>

				{target ? (
					<fieldset className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0">
						<legend className="sr-only">Recommendation actions</legend>
						{acceptState === "done" ? (
							<span className="inline-flex items-center gap-1.5 px-1 py-1.5 font-medium text-foreground text-xs">
								<Check className="size-3.5" aria-hidden />
								On your watchlist
							</span>
						) : (
							<DetailMotionButton
								type="button"
								className={primaryActionClassName}
								onClick={() => void handleAccept()}
								disabled={acceptState === "saving"}
							>
								{acceptState === "saving" ? "Adding…" : "Add to watchlist"}
							</DetailMotionButton>
						)}
						{sentBack ? (
							<span className="inline-flex items-center gap-1.5 px-1 py-1.5 font-medium text-foreground text-xs">
								<Check className="size-3.5" aria-hidden />
								Recommendation sent
							</span>
						) : (
							<DetailMotionButton
								type="button"
								className={secondaryActionClassName}
								onClick={handleRecommendBack}
							>
								Recommend something back
							</DetailMotionButton>
						)}
					</fieldset>
				) : null}
				<p className="text-destructive text-xs empty:hidden" role="status">
					{acceptState === "error"
						? "Couldn’t add to your watchlist. Try again."
						: null}
				</p>
			</div>
		</article>
	);
}
